import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type DiningTable } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';

/** 16 random bytes, URL-safe: unguessable, so a QR cannot be forged. */
export const newTableToken = () => randomBytes(16).toString('base64url');

export function toTableView(table: DiningTable) {
  return {
    id: table.id,
    label: table.label,
    zone: table.zone,
    token: table.token,
    position: table.position,
    active: table.active,
  };
}

const MAX_TABLES = 300;

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
  ) {}

  async list(userId: string) {
    const restaurantId = await this.access.restaurantIdOrNull(userId);
    if (!restaurantId) return [];
    const tables = await this.prisma.diningTable.findMany({
      where: { restaurantId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return tables.map(toTableView);
  }

  async create(userId: string, label: string, zone?: string | null) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.assertRoom(restaurantId, 1);
    const position = await this.nextPosition(restaurantId);
    try {
      const table = await this.prisma.diningTable.create({
        data: {
          restaurantId,
          label,
          zone: zone || null,
          token: newTableToken(),
          position,
        },
      });
      return toTableView(table);
    } catch (error) {
      throw duplicateLabel(error);
    }
  }

  /**
   * "Ajouter 20 tables": labels continue after the highest existing number
   * with the same prefix, so T1..T20 then T21..T40.
   */
  async bulkCreate(
    userId: string,
    count: number,
    prefix: string,
    zone?: string | null,
  ) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.assertRoom(restaurantId, count);
    const existing = await this.prisma.diningTable.findMany({
      where: { restaurantId },
      select: { label: true },
    });
    const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
    const highest = existing.reduce((max, { label }) => {
      const match = pattern.exec(label);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    let position = await this.nextPosition(restaurantId);
    const data = Array.from({ length: count }, (_, index) => ({
      restaurantId,
      label: `${prefix}${highest + index + 1}`,
      zone: zone || null,
      token: newTableToken(),
      position: position++,
    }));
    await this.prisma.diningTable.createMany({ data });
    return this.list(userId);
  }

  async update(
    userId: string,
    id: string,
    input: { label?: string; zone?: string | null; active?: boolean },
  ) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    try {
      const table = await this.prisma.diningTable.update({
        where: { id },
        data: {
          ...input,
          ...(input.zone !== undefined && { zone: input.zone || null }),
        },
      });
      return toTableView(table);
    } catch (error) {
      throw duplicateLabel(error);
    }
  }

  /** The old QR code of this table stops working; other tables are untouched. */
  async rotateToken(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    const table = await this.prisma.diningTable.update({
      where: { id },
      data: { token: newTableToken() },
    });
    return toTableView(table);
  }

  async remove(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.findOwned(restaurantId, id);
    await this.prisma.diningTable.delete({ where: { id } });
  }

  private async findOwned(restaurantId: string, id: string) {
    const table = await this.prisma.diningTable.findFirst({
      where: { id, restaurantId },
    });
    if (!table) throw new NotFoundException('Table introuvable');
    return table;
  }

  private async nextPosition(restaurantId: string) {
    const last = await this.prisma.diningTable.aggregate({
      where: { restaurantId },
      _max: { position: true },
    });
    return (last._max.position ?? -1) + 1;
  }

  private async assertRoom(restaurantId: string, adding: number) {
    const count = await this.prisma.diningTable.count({
      where: { restaurantId },
    });
    if (count + adding > MAX_TABLES) {
      throw new BadRequestException(`Maximum ${MAX_TABLES} tables`);
    }
  }
}

function duplicateLabel(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return new ConflictException('Une table porte déjà ce nom');
  }
  return error;
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
