import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EntitlementsService } from '../billing/entitlements.service';
import { fromMillimes } from '../common/money';
import { serviceDay, serviceHour } from '../common/service-day';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { buildSuggestions, promoPrice, type DishSnapshot } from './suggestions';

const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60_000;

type Tx = Prisma.TransactionClient;

/** "today", "tomorrow", "week" or a date → the end of that service day. */
function endOfServiceDay(value: string, now = new Date()): Date {
  const today = serviceDay(now).end;
  if (value === 'today') return today;
  if (value === 'tomorrow') return new Date(today.getTime() + DAY_MS);
  if (value === 'week') return new Date(today.getTime() + 6 * DAY_MS);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // The day after at 04:00 UTC = 05:00 in Tunis.
    const end = new Date(`${value}T04:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    if (end > now) return end;
    throw new BadRequestException('Cette date est déjà passée');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date <= now) {
    throw new BadRequestException('Date invalide');
  }
  return date;
}

/**
 * Stock, expiry dates, sales and anti-waste suggestions (S-01…S-04).
 * A tracked dish has batches; sales take from the batch that expires first,
 * and expired batches leave the stock as waste.
 */
@Injectable()
export class StockService {
  private readonly swept = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async restaurantFor(userId: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.entitlements.require(restaurantId, 'stock');
    return restaurantId;
  }

  private async dishOf(restaurantId: string, dishId: string) {
    const dish = await this.prisma.dish.findFirst({
      where: { id: dishId, category: { restaurantId } },
    });
    if (!dish) throw new NotFoundException('Plat introuvable');
    return dish;
  }

  /* ───────────── expiry ───────────── */

  /** Expired batches leave the stock and are recorded as waste. */
  async sweep(restaurantId: string) {
    const expired = await this.prisma.stockBatch.findMany({
      where: {
        restaurantId,
        remaining: { gt: 0 },
        expiresAt: { lte: new Date() },
      },
    });
    for (const batch of expired) {
      await this.prisma.$transaction(async (tx) => {
        // Conditional: two sweeps at once count the batch once.
        const { count } = await tx.stockBatch.updateMany({
          where: { id: batch.id, remaining: batch.remaining },
          data: { remaining: 0 },
        });
        if (!count) return;
        await tx.dish.update({
          where: { id: batch.dishId },
          data: { stockQty: { decrement: batch.remaining } },
        });
        await tx.stockMovement.create({
          data: {
            restaurantId,
            dishId: batch.dishId,
            batchId: batch.id,
            type: 'WASTE',
            quantity: -batch.remaining,
            reason: 'Périmé',
          },
        });
      });
    }
  }

  /** For the guest menu: at most one sweep a minute per restaurant. */
  async sweepSoon(restaurantId: string) {
    const last = this.swept.get(restaurantId) ?? 0;
    if (Date.now() - last < SWEEP_EVERY_MS) return;
    this.swept.set(restaurantId, Date.now());
    await this.sweep(restaurantId);
  }

  /* ───────────── owner screen ───────────── */

  async overview(userId: string) {
    const restaurantId = await this.restaurantFor(userId);
    await this.sweep(restaurantId);
    const now = new Date();
    const day = serviceDay(now);
    const since14 = new Date(day.start.getTime() - 13 * DAY_MS);
    const since7 = new Date(day.start.getTime() - 6 * DAY_MS);
    const hourNow = serviceHour(now);

    const [dishes, batches, sales, firstOrder, waste] = await Promise.all([
      this.prisma.dish.findMany({
        where: { category: { restaurantId } },
        include: { category: { select: { name: true, position: true } } },
        orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }],
      }),
      this.prisma.stockBatch.findMany({
        where: { restaurantId, remaining: { gt: 0 } },
        orderBy: [
          { expiresAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.$queryRaw<
        {
          dishId: string;
          today: number;
          week: number;
          total: number;
          late: number;
        }[]
      >(Prisma.sql`
        SELECT oi."dishId",
          coalesce(sum(oi.quantity) FILTER (WHERE o."createdAt" >= ${day.start}), 0)::int AS today,
          coalesce(sum(oi.quantity) FILTER (WHERE o."createdAt" >= ${since7}), 0)::int AS week,
          sum(oi.quantity)::int AS total,
          coalesce(sum(oi.quantity) FILTER (WHERE
            ((extract(hour FROM (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis'))::int + 19) % 24) >= ${hourNow}
          ), 0)::int AS late
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."restaurantId" = ${restaurantId}
          AND o.status NOT IN ('REJECTED', 'CANCELLED')
          AND o."createdAt" >= ${since14}
          AND oi."dishId" IS NOT NULL
        GROUP BY oi."dishId"`),
      this.prisma.order.findFirst({
        where: { restaurantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.$queryRaw<{ quantity: number; millimes: number }[]>(
        Prisma.sql`
        SELECT coalesce(sum(-m.quantity), 0)::int AS quantity,
          coalesce(sum(-m.quantity * d."priceMillimes"), 0)::int AS millimes
        FROM "StockMovement" m JOIN "Dish" d ON d.id = m."dishId"
        WHERE m."restaurantId" = ${restaurantId} AND m.type = 'WASTE'
          AND m."createdAt" >= ${new Date(now.getTime() - 30 * DAY_MS)}`,
      ),
    ]);

    const salesBy = new Map(sales.map((s) => [s.dishId, s]));
    const batchesBy = new Map<string, typeof batches>();
    for (const batch of batches) {
      batchesBy.set(batch.dishId, [
        ...(batchesBy.get(batch.dishId) ?? []),
        batch,
      ]);
    }
    const daysObserved = firstOrder
      ? Math.min(
          14,
          Math.max(
            1,
            Math.ceil(
              (now.getTime() - firstOrder.createdAt.getTime()) / DAY_MS,
            ),
          ),
        )
      : 1;
    // Without history, assume sales spread evenly from 07:00 to midnight.
    const hourTunis = (hourNow + 5) % 24;
    const defaultLate =
      hourTunis < 5 ? 0.05 : hourTunis < 7 ? 1 : (24 - hourTunis) / 17;

    const snapshots: DishSnapshot[] = [];
    const rows = dishes.map((dish) => {
      const s = salesBy.get(dish.id);
      const own = batchesBy.get(dish.id) ?? [];
      const promoActive =
        dish.promoPriceMillimes !== null &&
        dish.promoEndsAt !== null &&
        dish.promoEndsAt > now;
      if (dish.available) {
        snapshots.push({
          id: dish.id,
          name: dish.name,
          tracked: dish.trackStock,
          stockQty: dish.stockQty,
          batches: own.map((b) => ({
            remaining: b.remaining,
            expiresAt: b.expiresAt,
          })),
          sold14: s?.total ?? 0,
          lateShare: s?.total ? s.late / s.total : defaultLate,
          promoActive,
        });
      }
      const perDay = (s?.total ?? 0) / daysObserved;
      const next = own.find((b) => b.expiresAt)?.expiresAt ?? null;
      return {
        id: dish.id,
        name: dish.name,
        category: dish.category.name,
        available: dish.available,
        price: fromMillimes(dish.priceMillimes),
        tracked: dish.trackStock,
        stockQty: dish.trackStock ? dish.stockQty : null,
        soldToday: s?.today ?? 0,
        sold7: s?.week ?? 0,
        perDay: Math.round(perDay * 10) / 10,
        // How many days the stock lasts at the usual pace.
        daysOfCover:
          dish.trackStock && perDay > 0
            ? Math.round((dish.stockQty / perDay) * 10) / 10
            : null,
        nextExpiry: next,
        batches: own.map((b) => ({
          id: b.id,
          remaining: b.remaining,
          expiresAt: b.expiresAt,
          createdAt: b.createdAt,
        })),
        promo: promoActive
          ? {
              price: fromMillimes(dish.promoPriceMillimes!),
              endsAt: dish.promoEndsAt!,
              percent: Math.round(
                (1 - dish.promoPriceMillimes! / dish.priceMillimes) * 100,
              ),
            }
          : null,
      };
    });

    return {
      day: day.key,
      daysObserved,
      dishes: rows,
      waste30: {
        quantity: waste[0]?.quantity ?? 0,
        value: fromMillimes(waste[0]?.millimes ?? 0),
      },
      suggestions: buildSuggestions(snapshots, {
        now,
        endOfDay: day.end,
        daysObserved,
      }),
    };
  }

  async setTracking(userId: string, dishId: string, track: boolean) {
    const restaurantId = await this.restaurantFor(userId);
    await this.dishOf(restaurantId, dishId);
    await this.prisma.dish.update({
      where: { id: dishId },
      data: { trackStock: track },
    });
    return { tracked: track };
  }

  async restock(
    userId: string,
    dishId: string,
    input: { quantity: number; expiresOn?: string },
    actor: string,
  ) {
    const restaurantId = await this.restaurantFor(userId);
    await this.dishOf(restaurantId, dishId);
    const expiresAt = input.expiresOn ? endOfServiceDay(input.expiresOn) : null;
    await this.prisma.$transaction(async (tx) => {
      const batch = await tx.stockBatch.create({
        data: {
          restaurantId,
          dishId,
          quantity: input.quantity,
          remaining: input.quantity,
          expiresAt,
        },
      });
      await tx.stockMovement.create({
        data: {
          restaurantId,
          dishId,
          batchId: batch.id,
          type: 'RESTOCK',
          quantity: input.quantity,
          actor,
        },
      });
      // Adding stock starts the tracking.
      await tx.dish.update({
        where: { id: dishId },
        data: { trackStock: true, stockQty: { increment: input.quantity } },
      });
    });
    return { added: input.quantity, expiresAt };
  }

  /** Inventory count: "there are 7 left" corrects the stock to 7. */
  async count(userId: string, dishId: string, quantity: number, actor: string) {
    const restaurantId = await this.restaurantFor(userId);
    await this.sweep(restaurantId);
    const dish = await this.dishOf(restaurantId, dishId);
    const diff = quantity - (dish.trackStock ? dish.stockQty : 0);
    await this.prisma.$transaction(async (tx) => {
      if (diff > 0) {
        const batch = await tx.stockBatch.create({
          data: { restaurantId, dishId, quantity: diff, remaining: diff },
        });
        await tx.stockMovement.create({
          data: {
            restaurantId,
            dishId,
            batchId: batch.id,
            type: 'ADJUST',
            quantity: diff,
            reason: 'Inventaire',
            actor,
          },
        });
      } else if (diff < 0) {
        await this.remove(tx, restaurantId, dishId, -diff, {
          type: 'ADJUST',
          reason: 'Inventaire',
          actor,
        });
      }
      await tx.dish.update({
        where: { id: dishId },
        data: { trackStock: true, stockQty: quantity },
      });
    });
    return { stockQty: quantity };
  }

  async waste(
    userId: string,
    dishId: string,
    input: { quantity: number; reason?: string },
    actor: string,
  ) {
    const restaurantId = await this.restaurantFor(userId);
    await this.sweep(restaurantId);
    const dish = await this.dishOf(restaurantId, dishId);
    if (!dish.trackStock || dish.stockQty < input.quantity) {
      throw new ConflictException(
        `Le stock n'est que de ${dish.trackStock ? dish.stockQty : 0}`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.remove(tx, restaurantId, dishId, input.quantity, {
        type: 'WASTE',
        reason: input.reason || 'Jeté',
        actor,
      });
      await tx.dish.update({
        where: { id: dishId },
        data: { stockQty: { decrement: input.quantity } },
      });
    });
    return { stockQty: dish.stockQty - input.quantity };
  }

  async setPromo(
    userId: string,
    dishId: string,
    input: { percent: number; until: string },
  ) {
    const restaurantId = await this.restaurantFor(userId);
    const dish = await this.dishOf(restaurantId, dishId);
    const promoEndsAt = endOfServiceDay(input.until);
    const promoPriceMillimes = promoPrice(dish.priceMillimes, input.percent);
    if (promoPriceMillimes >= dish.priceMillimes) {
      throw new BadRequestException('Ce prix est trop bas pour une promo');
    }
    await this.prisma.dish.update({
      where: { id: dishId },
      data: { promoPriceMillimes, promoEndsAt },
    });
    return { price: fromMillimes(promoPriceMillimes), endsAt: promoEndsAt };
  }

  async clearPromo(userId: string, dishId: string) {
    const restaurantId = await this.restaurantFor(userId);
    await this.dishOf(restaurantId, dishId);
    await this.prisma.dish.update({
      where: { id: dishId },
      data: { promoPriceMillimes: null, promoEndsAt: null },
    });
  }

  async movements(userId: string, dishId?: string) {
    const restaurantId = await this.restaurantFor(userId);
    const rows = await this.prisma.stockMovement.findMany({
      where: { restaurantId, ...(dishId && { dishId }) },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { dish: { select: { name: true } } },
    });
    return rows.map((m) => ({
      id: m.id,
      dish: m.dish.name,
      type: m.type,
      quantity: m.quantity,
      reason: m.reason,
      actor: m.actor,
      createdAt: m.createdAt,
    }));
  }

  /* ───────────── orders ───────────── */

  /**
   * Takes the ordered quantities from the stock, inside the order's
   * transaction. Refuses the order when a tracked dish does not have enough.
   */
  async consume(
    tx: Tx,
    restaurantId: string,
    orderId: string,
    lines: {
      dishId: string;
      name: string;
      quantity: number;
      tracked: boolean;
    }[],
  ) {
    const wanted = new Map<string, { name: string; quantity: number }>();
    for (const line of lines) {
      if (!line.tracked) continue;
      const entry = wanted.get(line.dishId) ?? { name: line.name, quantity: 0 };
      entry.quantity += line.quantity;
      wanted.set(line.dishId, entry);
    }
    for (const [dishId, { name, quantity }] of wanted) {
      // Conditional: two orders for the last brik cannot both take it.
      const { count } = await tx.dish.updateMany({
        where: { id: dishId, stockQty: { gte: quantity } },
        data: { stockQty: { decrement: quantity } },
      });
      if (!count) {
        const left =
          (await tx.dish.findUnique({ where: { id: dishId } }))?.stockQty ?? 0;
        throw new ConflictException(
          left > 0
            ? `Il ne reste que ${left} × ${name}`
            : `« ${name} » est épuisé`,
        );
      }
      await this.remove(tx, restaurantId, dishId, quantity, {
        type: 'SALE',
        orderId,
      });
    }
  }

  /** A refused or cancelled order gives its stock back, once. */
  async release(tx: Tx, restaurantId: string, orderId: string) {
    const [sales, returned] = await Promise.all([
      tx.stockMovement.findMany({ where: { orderId, type: 'SALE' } }),
      tx.stockMovement.count({ where: { orderId, type: 'RETURN' } }),
    ]);
    if (returned) return;
    const now = new Date();
    for (const sale of sales) {
      const quantity = -sale.quantity;
      let batchId = sale.batchId;
      const batch = batchId
        ? await tx.stockBatch.findUnique({ where: { id: batchId } })
        : null;
      const expired = Boolean(batch?.expiresAt && batch.expiresAt <= now);
      if (batch && !expired) {
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: { remaining: { increment: quantity } },
        });
      } else if (!expired) {
        batchId = (
          await tx.stockBatch.create({
            data: {
              restaurantId,
              dishId: sale.dishId,
              quantity,
              remaining: quantity,
            },
          })
        ).id;
      }
      await tx.stockMovement.create({
        data: {
          restaurantId,
          dishId: sale.dishId,
          batchId,
          type: 'RETURN',
          quantity,
          orderId,
        },
      });
      if (expired) {
        // It came back after its date: it cannot be sold again.
        await tx.stockMovement.create({
          data: {
            restaurantId,
            dishId: sale.dishId,
            batchId,
            type: 'WASTE',
            quantity: -quantity,
            reason: 'Périmé',
            orderId,
          },
        });
      } else {
        await tx.dish.update({
          where: { id: sale.dishId },
          data: { stockQty: { increment: quantity } },
        });
      }
    }
  }

  /** Takes a quantity from the batches, the one that expires first first. */
  private async remove(
    tx: Tx,
    restaurantId: string,
    dishId: string,
    quantity: number,
    movement: {
      type: 'SALE' | 'WASTE' | 'ADJUST';
      reason?: string;
      actor?: string;
      orderId?: string;
    },
  ) {
    const batches = await tx.stockBatch.findMany({
      where: { dishId, remaining: { gt: 0 } },
      orderBy: [
        { expiresAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    let left = quantity;
    for (const batch of batches) {
      if (left <= 0) break;
      const take = Math.min(batch.remaining, left);
      await tx.stockBatch.update({
        where: { id: batch.id },
        data: { remaining: { decrement: take } },
      });
      await tx.stockMovement.create({
        data: {
          restaurantId,
          dishId,
          batchId: batch.id,
          quantity: -take,
          ...movement,
        },
      });
      left -= take;
    }
    if (left > 0) {
      // Stock known only as a number (no batch left to take from).
      await tx.stockMovement.create({
        data: { restaurantId, dishId, quantity: -left, ...movement },
      });
    }
  }
}
