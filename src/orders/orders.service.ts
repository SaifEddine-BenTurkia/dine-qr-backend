import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type OrderStatus, type PaymentMethod } from '@prisma/client';
import {
  EntitlementsService,
  planRequired,
} from '../billing/entitlements.service';
import { ENTITLEMENTS, effectivePlan } from '../billing/plan-catalog';
import { isMenuLive } from '../billing/subscription-status';
import { formatDinars, fromMillimes, sumMillimes } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { ServiceHub } from '../service/service-hub';

export interface OrderLineInput {
  dishId: string;
  quantity: number;
  note?: string;
}

const MAX_OPEN_GUEST_ORDERS = 3;
const ACTIVE: OrderStatus[] = ['PENDING', 'ACCEPTED', 'READY', 'SERVED'];
// Orders a cashier can still put on a bill.
const BILLABLE: OrderStatus[] = ['ACCEPTED', 'READY', 'SERVED'];

/**
 * A service day runs from 05:00 to 05:00 in Tunis (04:00 UTC, no DST): a café
 * open until 2 a.m. keeps the same day for its numbers and its Z report.
 */
export function serviceDay(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(4, 0, 0, 0);
  if (start > now) start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { key: start.toISOString().slice(0, 10), start, end };
}

/** "2 × Café, 1 × Brik" for notifications. */
function summary(items: { quantity: number; name: string }[]) {
  const text = items.map((i) => `${i.quantity} × ${i.name}`).join(', ');
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
}

const orderInclude = {
  items: { orderBy: { position: 'asc' } },
  table: { select: { id: true, label: true, zone: true } },
} satisfies Prisma.OrderInclude;

type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderView(order: OrderWithItems) {
  return {
    id: order.id,
    number: order.number,
    source: order.source,
    status: order.status,
    table: order.table
      ? { id: order.table.id, label: order.table.label, zone: order.table.zone }
      : null,
    note: order.note,
    rejectReason: order.rejectReason,
    total: fromMillimes(order.totalMillimes),
    totalMillimes: order.totalMillimes,
    billed: order.billId !== null,
    createdBy: order.createdBy,
    createdAt: order.createdAt,
    acceptedAt: order.acceptedAt,
    readyAt: order.readyAt,
    servedAt: order.servedAt,
    items: order.items.map((item) => ({
      id: item.id,
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      note: item.note,
      unitPrice: fromMillimes(item.unitPriceMillimes),
      total: fromMillimes(item.totalMillimes),
      totalMillimes: item.totalMillimes,
    })),
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly hub: ServiceHub,
    private readonly entitlements: EntitlementsService,
    private readonly push: PushService,
  ) {}

  /** The caisse belongs to Premium; counter sales and closing to Business. */
  private async restaurantFor(
    userId: string,
    feature: 'ordering' | 'counterSales' = 'ordering',
  ) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    await this.entitlements.require(restaurantId, feature);
    return restaurantId;
  }

  /* ───────────── guest side (O-01) ───────────── */

  async createFromGuest(
    slug: string,
    input: {
      sessionId: string;
      tableToken: string;
      items: OrderLineInput[];
      note?: string;
    },
  ) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true,
        orderingEnabled: true,
        user: { select: { subscription: true } },
      },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');
    if (!isMenuLive(restaurant.user.subscription)) {
      throw new HttpException(
        "Ce menu n'est pas disponible pour le moment",
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    if (!ENTITLEMENTS[effectivePlan(restaurant.user.subscription)].ordering) {
      throw planRequired('ordering');
    }
    if (!restaurant.orderingEnabled) {
      throw new ForbiddenException(
        'Ce restaurant ne prend pas les commandes en ligne',
      );
    }
    // Ordering needs the QR code on the table: nobody orders from outside.
    const table = await this.prisma.diningTable.findFirst({
      where: {
        token: input.tableToken,
        restaurantId: restaurant.id,
        active: true,
      },
    });
    if (!table) {
      throw new BadRequestException(
        'Scannez le QR code de votre table pour commander',
      );
    }
    const open = await this.prisma.order.count({
      where: {
        restaurantId: restaurant.id,
        sessionId: input.sessionId,
        status: 'PENDING',
      },
    });
    if (open >= MAX_OPEN_GUEST_ORDERS) {
      throw new ConflictException(
        'Vos commandes précédentes attendent encore la validation',
      );
    }
    const order = await this.create(restaurant.id, {
      source: 'TABLE',
      status: 'PENDING',
      tableId: table.id,
      sessionId: input.sessionId,
      items: input.items,
      note: input.note,
    });
    this.hub.publish(restaurant.id, {
      kind: 'order',
      id: order.id,
      number: order.number,
      table: table.label,
    });
    this.push.notify(restaurant.id, ['OWNER', 'MANAGER', 'CASHIER'], {
      title: `Nouvelle commande N° ${order.number} · table ${table.label}`,
      body: `${summary(order.items)} · ${formatDinars(order.totalMillimes)}`,
      tag: `order-${order.id}`,
      sticky: true,
    });
    return order;
  }

  /** The guest's orders of the current service day, newest first. */
  async guestOrders(slug: string, sessionId: string) {
    const restaurantId = await this.restaurantIdBySlug(slug);
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        sessionId,
        createdAt: { gte: serviceDay().start },
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(toOrderView);
  }

  async cancelFromGuest(slug: string, id: string, sessionId: string) {
    const restaurantId = await this.restaurantIdBySlug(slug);
    const { count } = await this.prisma.order.updateMany({
      where: { id, restaurantId, sessionId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (!count) {
      throw new ConflictException(
        'Cette commande est déjà acceptée : demandez au serveur',
      );
    }
    this.hub.publish(restaurantId, {
      kind: 'order-update',
      id,
      status: 'CANCELLED',
    });
    return { status: 'CANCELLED' };
  }

  /* ───────────── caisse side (O-02, O-04, O-05) ───────────── */

  /** Orders still in progress, plus today's closed ones for the history. */
  async list(userId: string) {
    const restaurantId = await this.restaurantFor(userId);
    const day = serviceDay();
    const orders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        OR: [
          { status: { in: ACTIVE }, billId: null },
          { createdAt: { gte: day.start } },
        ],
      },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
    return orders.map(toOrderView);
  }

  async createAtCounter(
    userId: string,
    actor: string,
    input: { items: OrderLineInput[]; note?: string; tableId?: string },
  ) {
    const restaurantId = await this.restaurantFor(userId, 'counterSales');
    if (input.tableId) {
      const table = await this.prisma.diningTable.count({
        where: { id: input.tableId, restaurantId },
      });
      if (!table) throw new NotFoundException('Table introuvable');
    }
    const order = await this.create(restaurantId, {
      source: 'COUNTER',
      status: 'ACCEPTED',
      tableId: input.tableId,
      items: input.items,
      note: input.note,
      createdBy: actor,
    });
    this.hub.publish(restaurantId, {
      kind: 'order-update',
      id: order.id,
      status: order.status,
    });
    return order;
  }

  async setStatus(
    userId: string,
    id: string,
    next: 'ACCEPTED' | 'REJECTED' | 'READY' | 'SERVED',
    reason?: string,
  ) {
    const restaurantId = await this.restaurantFor(userId);
    const from: Record<typeof next, OrderStatus[]> = {
      ACCEPTED: ['PENDING'],
      REJECTED: ['PENDING'],
      READY: ['ACCEPTED'],
      SERVED: ['ACCEPTED', 'READY'],
    };
    const now = new Date();
    const { count } = await this.prisma.order.updateMany({
      where: { id, restaurantId, status: { in: from[next] } },
      data: {
        status: next,
        ...(next === 'ACCEPTED' && { acceptedAt: now }),
        ...(next === 'REJECTED' && { rejectReason: reason ?? null }),
        ...(next === 'READY' && { readyAt: now }),
        ...(next === 'SERVED' && { servedAt: now }),
      },
    });
    const order = await this.prisma.order.findFirst({
      where: { id, restaurantId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (!count) {
      throw new ConflictException(
        `Cette commande est déjà « ${order.status.toLowerCase()} »`,
      );
    }
    this.hub.publish(restaurantId, {
      kind: 'order-update',
      id,
      status: next,
    });
    if (next === 'READY') {
      // Whoever serves takes it to the table.
      this.push.notify(
        restaurantId,
        ['OWNER', 'MANAGER', 'CASHIER', 'WAITER'],
        {
          title: `Commande N° ${order.number} prête`,
          body: order.table
            ? `À servir table ${order.table.label} · ${summary(toOrderView(order).items)}`
            : `Comptoir · ${summary(toOrderView(order).items)}`,
          tag: `order-${order.id}`,
        },
      );
    }
    return toOrderView(order);
  }

  /** Open tabs: per table (and counter), the orders not yet paid. */
  async openTabs(userId: string) {
    const restaurantId = await this.restaurantFor(userId);
    const orders = await this.prisma.order.findMany({
      where: { restaurantId, billId: null, status: { in: BILLABLE } },
      include: orderInclude,
      orderBy: { createdAt: 'asc' },
    });
    const tabs = new Map<string, ReturnType<typeof toOrderView>[]>();
    for (const order of orders.map(toOrderView)) {
      const key = order.table?.id ?? `counter:${order.id}`;
      tabs.set(key, [...(tabs.get(key) ?? []), order]);
    }
    return [...tabs.values()].map((list) => ({
      table: list[0].table,
      orders: list,
      total: fromMillimes(sumMillimes(list.map((o) => o.totalMillimes))),
      totalMillimes: sumMillimes(list.map((o) => o.totalMillimes)),
      since: list[0].createdAt,
    }));
  }

  async pay(
    userId: string,
    actor: string,
    input: {
      orderIds: string[];
      method: PaymentMethod;
      discountMillimes?: number;
    },
  ) {
    const restaurantId = await this.restaurantFor(userId);
    const bill = await this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          id: { in: input.orderIds },
          restaurantId,
          billId: null,
          status: { in: BILLABLE },
        },
      });
      if (orders.length !== input.orderIds.length) {
        throw new ConflictException(
          'Une commande a changé ou est déjà payée : rechargez la caisse',
        );
      }
      const tableIds = new Set(orders.map((o) => o.tableId));
      const subtotal = sumMillimes(orders.map((o) => o.totalMillimes));
      const discount = Math.min(input.discountMillimes ?? 0, subtotal);
      const number = await this.nextNumber(tx, restaurantId, 'bill');
      const created = await tx.bill.create({
        data: {
          restaurantId,
          number,
          tableId: tableIds.size === 1 ? [...tableIds][0] : null,
          subtotalMillimes: subtotal,
          discountMillimes: discount,
          totalMillimes: subtotal - discount,
          method: input.method,
          cashierName: actor,
        },
      });
      await tx.order.updateMany({
        where: { id: { in: input.orderIds } },
        data: { billId: created.id },
      });
      // Paying closes the service of these orders.
      await tx.order.updateMany({
        where: {
          id: { in: input.orderIds },
          status: { in: ['ACCEPTED', 'READY'] },
        },
        data: { status: 'SERVED', servedAt: new Date() },
      });
      return created;
    });
    this.hub.publish(restaurantId, { kind: 'bill', id: bill.id });
    return this.receipt(userId, bill.id);
  }

  /** Everything a customer receipt prints (O-03). */
  async receipt(userId: string, billId: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    const bill = await this.prisma.bill.findFirst({
      where: { id: billId, restaurantId },
      include: {
        table: { select: { label: true } },
        orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        restaurant: {
          select: {
            name: true,
            receiptAddress: true,
            receiptPhone: true,
            taxId: true,
            receiptFooter: true,
          },
        },
      },
    });
    if (!bill) throw new NotFoundException('Ticket introuvable');
    // Same dish at the same price on several orders: one receipt line.
    const lines = new Map<
      string,
      { name: string; quantity: number; unitPriceMillimes: number }
    >();
    for (const item of bill.orders.flatMap((o) => o.items)) {
      const key = `${item.name}|${item.unitPriceMillimes}`;
      const line = lines.get(key);
      if (line) line.quantity += item.quantity;
      else
        lines.set(key, {
          name: item.name,
          quantity: item.quantity,
          unitPriceMillimes: item.unitPriceMillimes,
        });
    }
    return {
      id: bill.id,
      number: bill.number,
      table: bill.table?.label ?? null,
      paidAt: bill.paidAt,
      method: bill.method,
      cashierName: bill.cashierName,
      restaurant: bill.restaurant,
      orderNumbers: bill.orders.map((o) => o.number),
      lines: [...lines.values()].map((line) => ({
        name: line.name,
        quantity: line.quantity,
        unitPrice: fromMillimes(line.unitPriceMillimes),
        total: fromMillimes(line.unitPriceMillimes * line.quantity),
      })),
      subtotal: fromMillimes(bill.subtotalMillimes),
      discount: fromMillimes(bill.discountMillimes),
      total: fromMillimes(bill.totalMillimes),
    };
  }

  /** Daily closing ("Z") for one service day: totals by payment method. */
  async dayReport(userId: string, dateKey?: string) {
    const restaurantId = await this.restaurantFor(userId, 'counterSales');
    const day = dateKey
      ? serviceDay(new Date(`${dateKey}T12:00:00Z`))
      : serviceDay();
    const [bills, orders, items] = await Promise.all([
      this.prisma.bill.findMany({
        where: { restaurantId, paidAt: { gte: day.start, lt: day.end } },
        select: {
          method: true,
          totalMillimes: true,
          discountMillimes: true,
        },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { restaurantId, createdAt: { gte: day.start, lt: day.end } },
        _count: true,
      }),
      this.prisma.orderItem.groupBy({
        by: ['name'],
        where: {
          order: {
            restaurantId,
            createdAt: { gte: day.start, lt: day.end },
            status: { in: BILLABLE },
          },
        },
        _sum: { quantity: true, totalMillimes: true },
        // Ties sorted by name, so the list is stable.
        orderBy: [{ _sum: { quantity: 'desc' } }, { name: 'asc' }],
        take: 15,
      }),
    ]);
    const byMethod = (method: PaymentMethod) =>
      sumMillimes(
        bills.filter((b) => b.method === method).map((b) => b.totalMillimes),
      );
    const unpaid = await this.prisma.order.aggregate({
      where: { restaurantId, billId: null, status: { in: BILLABLE } },
      _sum: { totalMillimes: true },
      _count: true,
    });
    return {
      day: day.key,
      from: day.start,
      to: day.end,
      bills: bills.length,
      total: fromMillimes(sumMillimes(bills.map((b) => b.totalMillimes))),
      cash: fromMillimes(byMethod('CASH')),
      card: fromMillimes(byMethod('CARD')),
      discounts: fromMillimes(
        sumMillimes(bills.map((b) => b.discountMillimes)),
      ),
      orders: Object.fromEntries(orders.map((o) => [o.status, o._count])),
      unpaid: {
        orders: unpaid._count,
        total: fromMillimes(unpaid._sum.totalMillimes ?? 0),
      },
      topItems: items.map((item) => ({
        name: item.name,
        quantity: item._sum.quantity ?? 0,
        total: fromMillimes(item._sum.totalMillimes ?? 0),
      })),
    };
  }

  /* ───────────── shared ───────────── */

  private async create(
    restaurantId: string,
    input: {
      source: 'TABLE' | 'COUNTER';
      status: OrderStatus;
      tableId?: string;
      sessionId?: string;
      items: OrderLineInput[];
      note?: string;
      createdBy?: string;
    },
  ) {
    // Prices always come from the menu, never from the client.
    const dishIds = [...new Set(input.items.map((i) => i.dishId))];
    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: dishIds }, category: { restaurantId } },
    });
    const byId = new Map(dishes.map((d) => [d.id, d]));
    const now = new Date();
    for (const line of input.items) {
      const dish = byId.get(line.dishId);
      if (!dish || !dish.available) {
        throw new BadRequestException('Un plat de la commande est introuvable');
      }
      const soldOut =
        dish.soldOut && (!dish.soldOutUntil || dish.soldOutUntil > now);
      if (soldOut) {
        throw new ConflictException(`« ${dish.name} » est épuisé`);
      }
    }
    const lines = input.items.map((line, position) => {
      const dish = byId.get(line.dishId)!;
      return {
        dishId: dish.id,
        name: dish.name,
        unitPriceMillimes: dish.priceMillimes,
        quantity: line.quantity,
        note: line.note?.trim() || null,
        totalMillimes: dish.priceMillimes * line.quantity,
        position,
      };
    });
    const order = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, restaurantId, 'order');
      return tx.order.create({
        data: {
          restaurantId,
          number,
          source: input.source,
          status: input.status,
          tableId: input.tableId ?? null,
          sessionId: input.sessionId ?? null,
          note: input.note?.trim() || null,
          createdBy: input.createdBy ?? null,
          acceptedAt: input.status === 'ACCEPTED' ? now : null,
          totalMillimes: sumMillimes(lines.map((l) => l.totalMillimes)),
          items: { create: lines },
        },
        include: orderInclude,
      });
    });
    return toOrderView(order);
  }

  /**
   * Daily numbers (#1, #2…) per restaurant, reset at the start of each service
   * day. Bills share the counter's day but count separately via their table.
   */
  private async nextNumber(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    kind: 'order' | 'bill',
  ) {
    const { key, start } = serviceDay();
    if (kind === 'bill') {
      const count = await tx.bill.count({
        where: { restaurantId, paidAt: { gte: start } },
      });
      return count + 1;
    }
    // One atomic statement: two orders at the same moment get 7 and 8.
    const rows = await tx.$queryRaw<{ orderSeq: number }[]>(Prisma.sql`
      UPDATE "Restaurant"
      SET "orderSeq" = CASE WHEN "orderSeqDay" = ${key} THEN "orderSeq" + 1 ELSE 1 END,
          "orderSeqDay" = ${key}
      WHERE id = ${restaurantId}
      RETURNING "orderSeq"`);
    return rows[0].orderSeq;
  }

  private async restaurantIdBySlug(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) throw new NotFoundException('Menu introuvable');
    return restaurant.id;
  }
}
