import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAccess } from './admin';

/**
 * Two kinds of accounts that never share screens or endpoints:
 * `admin` runs the platform (emails in ADMIN_EMAILS), `restaurant` runs one
 * restaurant. Staff roles inside a restaurant come with P0-11.
 */
export type AccountRole = 'admin' | 'restaurant' | 'staff';

export interface AuthUser {
  id: string;
  email: string;
  role: AccountRole;
  /** The session passed the admin second factor (authenticator code). */
  mfa: boolean;
  /** Staff sessions (PIN on a shared device): their restaurant and job. */
  staff?: { restaurantId: string; role: StaffRole; name: string };
}

export interface JwtPayload {
  sub: string;
  ver: number;
  mfa?: boolean;
  /** Present on staff sessions, whose `sub` is a StaffMember id. */
  kind?: 'staff';
}

type AuthedRequest = Request & { user?: AuthUser };

const ALLOW_UNVERIFIED = 'allowUnverifiedEmail';

const QUERY_TOKEN = 'allowQueryToken';

/**
 * Accepts the session token as `?access_token=` on this route. Only for
 * Server-Sent Events: the browser's EventSource cannot send headers.
 */
export const AllowQueryToken = () => SetMetadata(QUERY_TOKEN, true);

const ROLE = 'accountRole';

const STAFF_ROLES = 'staffRoles';

type Allowed = AccountRole | 'any';

/**
 * Which account roles may call these routes. Without it a route is for
 * restaurant accounts only; `any` is for routes every user account needs
 * (/auth/me). Staff sessions reach only routes that list 'staff'.
 */
export const ForRole = (...roles: Allowed[]) => SetMetadata(ROLE, roles);

/** Narrows 'staff' access to some jobs (e.g. only cashiers accept orders). */
export const StaffRoles = (...roles: StaffRole[]) =>
  SetMetadata(STAFF_ROLES, roles);

/** Lets a signed-in user whose email is not yet verified reach this route. */
export const AllowUnverifiedEmail = () => SetMetadata(ALLOW_UNVERIFIED, true);

/**
 * Sign-up is open: a restaurant account works as soon as it is created and
 * confirms its email later. Admin rights come from the email address
 * (ADMIN_EMAILS), so an admin account must prove it owns the address first.
 * REQUIRE_EMAIL_VERIFICATION=true brings back the strict rule for everyone.
 */
export function mustVerifyEmail(input: {
  verified: boolean;
  role: AccountRole;
  strict: boolean;
}) {
  if (input.verified) return false;
  return input.role === 'admin' || input.strict;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly admins: AdminAccess,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<Allowed[]>(ROLE, [
      context.getHandler(),
      context.getClass(),
    ]) ?? ['restaurant'];
    try {
      return await this.check(context, allowed);
    } catch (error) {
      // Console routes do not admit they exist to anyone but an admin.
      if (allowed.length === 1 && allowed[0] === 'admin') {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  private async check(
    context: ExecutionContext,
    allowed: Allowed[],
  ): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    let [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const queryToken = req.query?.access_token;
    if (
      !token &&
      typeof queryToken === 'string' &&
      this.reflector.getAllAndOverride<boolean>(QUERY_TOKEN, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      [scheme, token] = ['Bearer', queryToken];
    }
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentification requise');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }

    if (payload.kind === 'staff') {
      return this.checkStaff(context, req, payload, allowed);
    }

    // Looked up on every request so a password reset revokes older sessions.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        tokenVersion: true,
        emailVerifiedAt: true,
      },
    });
    if (!user || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }

    const role: AccountRole = this.admins.isAdmin(user.email)
      ? 'admin'
      : 'restaurant';

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED,
      [context.getHandler(), context.getClass()],
    );
    if (
      !allowUnverified &&
      mustVerifyEmail({
        verified: user.emailVerifiedAt !== null,
        role,
        strict:
          this.config.get<string>('REQUIRE_EMAIL_VERIFICATION') === 'true',
      })
    ) {
      throw new ForbiddenException('Veuillez vérifier votre adresse email');
    }
    if (!allowed.includes('any') && !allowed.includes(role)) {
      throw new ForbiddenException(
        role === 'admin'
          ? 'Compte administrateur : utilisez la console /admin'
          : 'Accès réservé aux administrateurs',
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role,
      mfa: role === 'admin' && payload.mfa === true,
    };
    return true;
  }
  private async checkStaff(
    context: ExecutionContext,
    req: AuthedRequest,
    payload: JwtPayload,
    allowed: Allowed[],
  ): Promise<boolean> {
    const staff = await this.prisma.staffMember.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        tokenVersion: true,
        restaurantId: true,
      },
    });
    if (!staff || !staff.active || staff.tokenVersion !== payload.ver) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }
    if (!allowed.includes('staff')) {
      throw new ForbiddenException('Réservé au responsable du restaurant');
    }
    const jobs = this.reflector.getAllAndOverride<StaffRole[] | undefined>(
      STAFF_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (jobs && !jobs.includes(staff.role)) {
      throw new ForbiddenException('Votre rôle ne permet pas cette action');
    }
    req.user = {
      id: staff.id,
      email: '',
      role: 'staff',
      mfa: false,
      staff: {
        restaurantId: staff.restaurantId,
        role: staff.role,
        name: staff.name,
      },
    };
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUser => {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) throw new UnauthorizedException();
    return req.user;
  },
);
