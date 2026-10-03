import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { AdminAccess } from '../common/admin';
import { Prisma, type Subscription } from '@prisma/client';
import { BillingService, toRequestView } from '../billing/billing.service';
import {
  effectiveStatus,
  type EffectiveStatus,
} from '../billing/subscription-status';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the owner's current access (trial or paid period) ends, if any. */
function accessEndsAt(subscription: Subscription | null): Date | null {
  if (!subscription) return null;
  if (subscription.status === 'trialing') return subscription.trialEndsAt;
  if (subscription.status === 'active') return subscription.currentPeriodEnd;
  return null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly admins: AdminAccess,
  ) {}

  /**
   * Opens a restaurant account for an owner (verified, with the password the
   * admin gives them). With `takeOverSlug`, a restaurant set up under an admin
   * account moves to it, with its subscription: admins do not run restaurants.
   */
  async createRestaurantAccount(input: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    takeOverSlug?: string;
  }) {
    if (this.admins.isAdmin(input.email)) {
      throw new BadRequestException(
        "Cet email est celui d'un administrateur : choisissez-en un autre",
      );
    }
    if (await this.prisma.user.count({ where: { email: input.email } })) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }
    const restaurant = input.takeOverSlug
      ? await this.prisma.restaurant.findUnique({
          where: { slug: input.takeOverSlug },
          select: { id: true, userId: true, user: { select: { email: true } } },
        })
      : null;
    if (input.takeOverSlug) {
      if (!restaurant) throw new NotFoundException('Restaurant introuvable');
      if (!this.admins.isAdmin(restaurant.user.email)) {
        throw new ConflictException(
          'Ce restaurant appartient déjà à un compte restaurant',
        );
      }
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          phone: input.phone || null,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      if (restaurant) {
        await tx.restaurant.update({
          where: { id: restaurant.id },
          data: { userId: created.id },
        });
        await tx.subscription.updateMany({
          where: { userId: restaurant.userId },
          data: { userId: created.id },
        });
      }
      return created;
    });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      restaurantMoved: Boolean(restaurant),
    };
  }

  /** Platform health at a glance: accounts, live menus, revenue, what needs attention. */
  async overview() {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const yearAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    );

    const [
      users,
      restaurants,
      subscriptions,
      newAccounts,
      paid,
      pending,
      scans30d,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.restaurant.count(),
      this.prisma.subscription.findMany({
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              phone: true,
              restaurant: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      }),
      this.prisma.paymentRequest.findMany({
        where: { status: 'PAID', handledAt: { gte: yearAgo } },
        select: { amount: true, amountReceived: true, handledAt: true },
      }),
      this.prisma.paymentRequest.aggregate({
        where: { status: 'PENDING' },
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.scan.count({
        where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
      }),
    ]);

    const byStatus: Record<EffectiveStatus, number> = {
      trialing: 0,
      active: 0,
      past_due: 0,
      canceled: 0,
      none: 0,
    };
    for (const subscription of subscriptions)
      byStatus[effectiveStatus(subscription, now)] += 1;
    byStatus.none = users - subscriptions.length;

    // Revenue per calendar month for the last 12 months, oldest first.
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1),
      );
      return {
        month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        amount: 0,
      };
    });
    let thisMonth = 0;
    for (const p of paid) {
      if (!p.handledAt) continue;
      const amount = (p.amountReceived ?? p.amount).toNumber();
      const key = `${p.handledAt.getUTCFullYear()}-${String(p.handledAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket = months.find((m) => m.month === key);
      if (bucket) bucket.amount += amount;
      if (p.handledAt >= monthStart) thisMonth += amount;
    }
    const totalPaid = await this.prisma.paymentRequest.findMany({
      where: { status: 'PAID' },
      select: { amount: true, amountReceived: true },
    });

    // Live menus whose access ends within 7 days: the owners to call.
    const soon = new Date(now.getTime() + 7 * DAY_MS);
    const expiringSoon = subscriptions
      .map((s) => ({
        s,
        endsAt: accessEndsAt(s),
        status: effectiveStatus(s, now),
      }))
      .filter(
        ({ endsAt, status }) =>
          (status === 'trialing' || status === 'active') &&
          endsAt &&
          endsAt <= soon,
      )
      .sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime())
      .slice(0, 20)
      .map(({ s, endsAt, status }) => ({
        userId: s.userId,
        fullName: s.user.fullName,
        email: s.user.email,
        phone: s.user.phone,
        restaurant: s.user.restaurant,
        status,
        endsAt,
      }));

    return {
      accounts: {
        total: users,
        newLast30Days: newAccounts,
        withRestaurant: restaurants,
      },
      subscriptions: byStatus,
      liveMenus: byStatus.trialing + byStatus.active,
      revenue: {
        thisMonth: round(thisMonth),
        total: round(
          totalPaid.reduce(
            (sum, p) => sum + (p.amountReceived ?? p.amount).toNumber(),
            0,
          ),
        ),
        byMonth: months.map((m) => ({ ...m, amount: round(m.amount) })),
      },
      pendingPayments: {
        count: pending._count,
        amount: round(pending._sum.amount?.toNumber() ?? 0),
      },
      scansLast30Days: scans30d,
      expiringSoon,
      pricing: this.billing.pricing,
    };
  }

  /** Every account with its restaurant, subscription and payment totals. */
  async accounts(search?: string, status?: EffectiveStatus) {
    const now = new Date();
    const term = search?.trim();
    const where: Prisma.UserWhereInput = term
      ? {
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { fullName: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
            {
              restaurant: {
                is: { name: { contains: term, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {};

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            primaryColor: true,
            logoUrl: true,
          },
        },
        subscription: true,
      },
    });
    const userIds = users.map((u) => u.id);
    const restaurantIds = users.flatMap((u) =>
      u.restaurant ? [u.restaurant.id] : [],
    );

    const [payments, pending, dishCounts, scanCounts] = await Promise.all([
      this.prisma.paymentRequest.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: 'PAID' },
        _sum: { amountReceived: true },
        _max: { handledAt: true },
        _count: true,
      }),
      this.prisma.paymentRequest.findMany({
        where: { userId: { in: userIds }, status: 'PENDING' },
        select: { userId: true, reference: true, amount: true },
      }),
      restaurantIds.length
        ? this.prisma.$queryRaw<
            { restaurantId: string; count: number }[]
          >(Prisma.sql`
            SELECT c."restaurantId", count(d.id)::int AS count
            FROM "Category" c JOIN "Dish" d ON d."categoryId" = c.id
            WHERE c."restaurantId" IN (${Prisma.join(restaurantIds)})
            GROUP BY c."restaurantId"`)
        : Promise.resolve([]),
      restaurantIds.length
        ? this.prisma.scan.groupBy({
            by: ['restaurantId'],
            where: {
              restaurantId: { in: restaurantIds },
              createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
            },
            _count: true,
          })
        : Promise.resolve([]),
    ]);

    const paidBy = new Map(payments.map((p) => [p.userId, p]));
    const pendingBy = new Map(pending.map((p) => [p.userId, p]));
    const dishesBy = new Map(dishCounts.map((d) => [d.restaurantId, d.count]));
    const scansBy = new Map(scanCounts.map((s) => [s.restaurantId, s._count]));

    return users
      .map((user) => {
        const effective = effectiveStatus(user.subscription, now);
        const paidRow = paidBy.get(user.id);
        const pendingRow = pendingBy.get(user.id);
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerifiedAt !== null,
          role: this.admins.isAdmin(user.email) ? 'admin' : 'restaurant',
          createdAt: user.createdAt,
          restaurant: user.restaurant
            ? {
                name: user.restaurant.name,
                slug: user.restaurant.slug,
                createdAt: user.restaurant.createdAt,
                primaryColor: user.restaurant.primaryColor,
                logoUrl: user.restaurant.logoUrl,
                dishes: dishesBy.get(user.restaurant.id) ?? 0,
                scansLast30Days: scansBy.get(user.restaurant.id) ?? 0,
              }
            : null,
          subscription: {
            status: effective,
            trialEndsAt: user.subscription?.trialEndsAt ?? null,
            currentPeriodEnd: user.subscription?.currentPeriodEnd ?? null,
            accessEndsAt: accessEndsAt(user.subscription),
          },
          payments: {
            count: paidRow?._count ?? 0,
            totalPaid: round(paidRow?._sum.amountReceived?.toNumber() ?? 0),
            lastPaidAt: paidRow?._max.handledAt ?? null,
          },
          pendingRequest: pendingRow
            ? {
                reference: pendingRow.reference,
                amount: pendingRow.amount.toNumber(),
              }
            : null,
        };
      })
      .filter((account) => !status || account.subscription.status === status);
  }

  async accountPayments(userId: string) {
    const exists = await this.prisma.user.count({ where: { id: userId } });
    if (!exists) throw new NotFoundException('Compte introuvable');
    const requests = await this.prisma.paymentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => ({
      ...toRequestView(r),
      amountReceived: r.amountReceived?.toNumber() ?? null,
      handledBy: r.handledBy,
    }));
  }

  /** Gives free days: extends a running trial, or opens a new one for a lapsed account. */
  async extendTrial(userId: string, days: number) {
    const now = new Date();
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    const status = effectiveStatus(subscription, now);
    if (status === 'active') {
      throw new ConflictException(
        'Abonnement payé en cours : enregistrez plutôt un paiement.',
      );
    }
    const from =
      status === 'trialing' && subscription?.trialEndsAt
        ? subscription.trialEndsAt
        : now;
    const trialEndsAt = new Date(from.getTime() + days * DAY_MS);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, status: 'trialing', trialEndsAt },
      update: { status: 'trialing', trialEndsAt },
    });
    return { status: 'trialing', trialEndsAt };
  }

  async verifyEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    const verifiedAt = user.emailVerifiedAt ?? new Date();
    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: verifiedAt },
      });
    }
    return { emailVerified: true, verifiedAt };
  }

  /** Takes the public menu offline until the account pays or is given a trial. */
  async suspend(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, status: 'canceled' },
      update: { status: 'canceled' },
    });
    return { status: 'canceled' };
  }
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
