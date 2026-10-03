import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type StaffMember, type StaffRole } from '@prisma/client';
import { createHmac } from 'node:crypto';
import type { JwtPayload } from '../common/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';

const STAFF_SESSION_TTL = '14d';
// After this many wrong PINs on one restaurant within the window, its staff
// login pauses for the rest of the window (on top of the per-address limit).
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export function toStaffView(member: StaffMember) {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    active: member.active,
    lastLoginAt: member.lastLoginAt,
    createdAt: member.createdAt,
  };
}

/**
 * Staff of a restaurant (P0-11, lean version): cashiers, waiters, kitchen and
 * managers sign in on a shared device with the restaurant code and a PIN.
 */
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** PINs are low-entropy: keyed with a server secret and the restaurant. */
  private pinHash(restaurantId: string, pin: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`staff-pin:${restaurantId}:${pin}`)
      .digest('base64url');
  }

  async list(userId: string) {
    const restaurantId = await this.access.restaurantIdOrNull(userId);
    if (!restaurantId) return [];
    const members = await this.prisma.staffMember.findMany({
      where: { restaurantId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return members.map(toStaffView);
  }

  async create(
    userId: string,
    input: { name: string; role: StaffRole; pin: string },
  ) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    try {
      const member = await this.prisma.staffMember.create({
        data: {
          restaurantId,
          name: input.name,
          role: input.role,
          pinHash: this.pinHash(restaurantId, input.pin),
        },
      });
      return toStaffView(member);
    } catch (error) {
      throw this.pinConflict(error);
    }
  }

  async update(
    userId: string,
    id: string,
    input: { name?: string; role?: StaffRole; pin?: string; active?: boolean },
  ) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    const revokes =
      input.pin !== undefined ||
      input.role !== undefined ||
      input.active === false;
    try {
      const member = await this.prisma.staffMember.update({
        where: { id },
        data: {
          name: input.name,
          role: input.role,
          active: input.active,
          ...(input.pin !== undefined && {
            pinHash: this.pinHash(restaurantId, input.pin),
          }),
          ...(revokes && { tokenVersion: { increment: 1 } }),
        },
      });
      return toStaffView(member);
    } catch (error) {
      throw this.pinConflict(error);
    }
  }

  async remove(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    await this.prisma.staffMember.delete({ where: { id } });
  }

  async login(slug: string, pin: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    const refused = new UnauthorizedException(
      'Code restaurant ou PIN incorrect',
    );
    if (!restaurant) throw refused;
    if (this.recentFailures(restaurant.id) >= MAX_FAILURES) {
      throw new UnauthorizedException(
        'Trop d’essais : réessayez dans quelques minutes',
      );
    }
    const member = await this.prisma.staffMember.findUnique({
      where: {
        restaurantId_pinHash: {
          restaurantId: restaurant.id,
          pinHash: this.pinHash(restaurant.id, pin),
        },
      },
    });
    if (!member || !member.active) {
      this.failures.set(restaurant.id, [
        ...this.windowed(restaurant.id),
        Date.now(),
      ]);
      this.logger.warn(`Wrong staff PIN for restaurant ${restaurant.id}`);
      throw refused;
    }
    await this.prisma.staffMember.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() },
    });
    const payload: JwtPayload = {
      sub: member.id,
      ver: member.tokenVersion,
      kind: 'staff',
    };
    return {
      token: await this.jwt.signAsync(payload, {
        expiresIn: STAFF_SESSION_TTL,
      }),
      staff: await this.me(member.id),
    };
  }

  async me(staffId: string) {
    const member = await this.prisma.staffMember.findUniqueOrThrow({
      where: { id: staffId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            orderingEnabled: true,
          },
        },
      },
    });
    return { ...toStaffView(member), restaurant: member.restaurant };
  }

  private windowed(restaurantId: string) {
    const since = Date.now() - FAILURE_WINDOW_MS;
    return (this.failures.get(restaurantId) ?? []).filter((t) => t > since);
  }

  private recentFailures(restaurantId: string) {
    const list = this.windowed(restaurantId);
    this.failures.set(restaurantId, list);
    return list.length;
  }

  private async findOwned(restaurantId: string, id: string) {
    const member = await this.prisma.staffMember.findFirst({
      where: { id, restaurantId },
    });
    if (!member) throw new NotFoundException('Membre introuvable');
    return member;
  }

  private pinConflict(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Ce PIN est déjà utilisé par un autre membre : choisissez-en un autre',
      );
    }
    return error;
  }
}
