import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { resolveAppEnv } from '../config/app-env';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceHub } from '../service/service-hub';

const DAY_MS = 24 * 60 * 60 * 1000;
const startedAt = new Date();

/**
 * What happens on the platform, across every restaurant: guest visits,
 * service calls, feedback, adoption of the features, and the state of the
 * server. For the platform owner only (AdminGuard on the controller).
 */
@Injectable()
export class AdminActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: ServiceHub,
    private readonly ai: AiService,
    private readonly config: ConfigService,
  ) {}

  async activity(days: number) {
    const since = new Date(Date.now() - days * DAY_MS);

    const [
      restaurants,
      visits,
      requests,
      feedback,
      tables,
      lastEvents,
      googleClicks,
      daily,
      recentFeedback,
      open,
      lowRatings,
    ] = await Promise.all([
      this.prisma.restaurant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          enabledLocales: true,
          wifiSsid: true,
          googlePlaceId: true,
          createdAt: true,
          user: { select: { fullName: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // A visit is one guest session that opened the menu.
      this.prisma.$queryRaw<{ restaurantId: string; visits: number }[]>(
        Prisma.sql`
          SELECT "restaurantId", count(DISTINCT coalesce("sessionId", id))::int AS visits
          FROM "Event"
          WHERE type = 'menu_opened' AND "occurredAt" >= ${since}
          GROUP BY "restaurantId"`,
      ),
      this.prisma.$queryRaw<
        { restaurantId: string; total: number; avgSeconds: number | null }[]
      >(Prisma.sql`
          SELECT "restaurantId", count(*)::int AS total,
            avg(extract(epoch FROM ("acknowledgedAt" - "createdAt")))::float AS "avgSeconds"
          FROM "ServiceRequest"
          WHERE "createdAt" >= ${since}
          GROUP BY "restaurantId"`),
      this.prisma.feedback.groupBy({
        by: ['restaurantId'],
        where: { createdAt: { gte: since } },
        _count: true,
        _avg: { rating: true },
      }),
      this.prisma.diningTable.groupBy({
        by: ['restaurantId'],
        where: { active: true },
        _count: true,
      }),
      this.prisma.event.groupBy({
        by: ['restaurantId'],
        _max: { occurredAt: true },
      }),
      this.prisma.event.count({
        where: { type: 'google_review_clicked', occurredAt: { gte: since } },
      }),
      // Per day in Tunis time, oldest first, empty days included.
      this.prisma.$queryRaw<
        { day: string; visits: number; requests: number; feedback: number }[]
      >(Prisma.sql`
          WITH days AS (
            SELECT generate_series(
              ((now() AT TIME ZONE 'Africa/Tunis')::date - (${days}::int - 1)),
              (now() AT TIME ZONE 'Africa/Tunis')::date,
              interval '1 day')::date AS day
          )
          SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            (SELECT count(DISTINCT coalesce(e."sessionId", e.id))::int FROM "Event" e
              WHERE e.type = 'menu_opened'
                AND (e."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date = d.day) AS visits,
            (SELECT count(*)::int FROM "ServiceRequest" s
              WHERE (s."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date = d.day) AS requests,
            (SELECT count(*)::int FROM "Feedback" f
              WHERE (f."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date = d.day) AS feedback
          FROM days d ORDER BY d.day`),
      // Contact details stay with the restaurant: never sent to the admin view.
      this.prisma.feedback.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          rating: true,
          comment: true,
          tags: true,
          tableLabel: true,
          createdAt: true,
          restaurant: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.serviceRequest.findMany({
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        select: { restaurantId: true, createdAt: true },
      }),
      this.prisma.feedback.count({
        where: { createdAt: { gte: since }, rating: { lte: 3 } },
      }),
    ]);

    const visitsBy = new Map(visits.map((v) => [v.restaurantId, v.visits]));
    const requestsBy = new Map(requests.map((r) => [r.restaurantId, r]));
    const feedbackBy = new Map(feedback.map((f) => [f.restaurantId, f]));
    const tablesBy = new Map(tables.map((t) => [t.restaurantId, t._count]));
    const lastBy = new Map(
      lastEvents.map((e) => [e.restaurantId, e._max.occurredAt]),
    );
    const openBy = new Map<string, number>();
    for (const r of open)
      openBy.set(r.restaurantId, (openBy.get(r.restaurantId) ?? 0) + 1);

    const rows = restaurants.map((r) => {
      const req = requestsBy.get(r.id);
      const fb = feedbackBy.get(r.id);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        logoUrl: r.logoUrl,
        primaryColor: r.primaryColor,
        owner: r.user,
        createdAt: r.createdAt,
        visits: visitsBy.get(r.id) ?? 0,
        requests: req?.total ?? 0,
        avgResponseSeconds:
          req?.avgSeconds != null ? Math.round(req.avgSeconds) : null,
        openRequests: openBy.get(r.id) ?? 0,
        feedback: fb?._count ?? 0,
        avgRating: fb?._avg.rating != null ? round1(fb._avg.rating) : null,
        lastActivityAt: lastBy.get(r.id) ?? null,
        adoption: {
          tables: tablesBy.get(r.id) ?? 0,
          languages: r.enabledLocales.length,
          wifi: Boolean(r.wifiSsid),
          google: Boolean(r.googlePlaceId),
        },
      };
    });
    rows.sort(
      (a, b) =>
        b.visits - a.visits ||
        b.requests - a.requests ||
        a.name.localeCompare(b.name),
    );

    const sum = (pick: (row: (typeof rows)[number]) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    const answered = requests.filter((r) => r.avgSeconds != null);
    const answeredTotal = answered.reduce((t, r) => t + r.total, 0);
    const feedbackTotal = feedback.reduce((t, f) => t + f._count, 0);
    const oldestOpen = open.reduce<Date | null>(
      (oldest, r) => (!oldest || r.createdAt < oldest ? r.createdAt : oldest),
      null,
    );

    return {
      days,
      totals: {
        restaurants: rows.length,
        activeRestaurants: rows.filter((r) => r.visits > 0).length,
        visits: sum((r) => r.visits),
        requests: sum((r) => r.requests),
        avgResponseSeconds: answeredTotal
          ? Math.round(
              answered.reduce((t, r) => t + r.avgSeconds! * r.total, 0) /
                answeredTotal,
            )
          : null,
        feedback: feedbackTotal,
        avgRating: feedbackTotal
          ? round1(
              feedback.reduce((t, f) => t + (f._avg.rating ?? 0) * f._count, 0) /
                feedbackTotal,
            )
          : null,
        lowRatings,
        googleClicks,
        openRequests: open.length,
        oldestOpenAt: oldestOpen,
      },
      adoption: {
        withTables: rows.filter((r) => r.adoption.tables > 0).length,
        multilingual: rows.filter((r) => r.adoption.languages > 1).length,
        withWifi: rows.filter((r) => r.adoption.wifi).length,
        withGoogle: rows.filter((r) => r.adoption.google).length,
      },
      daily,
      restaurants: rows,
      recentFeedback,
    };
  }

  /** Server state, without any secret value. */
  async system() {
    const has = (key: string) => Boolean(this.config.get<string>(key)?.trim());
    let database: { ok: boolean; latencyMs: number | null } = {
      ok: false,
      latencyMs: null,
    };
    const t0 = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = { ok: true, latencyMs: Math.round(performance.now() - t0) };
    } catch {
      // reported as not ok
    }
    const memory = process.memoryUsage();
    const [users, restaurants, events, lastEvent] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.restaurant.count(),
      this.prisma.event.count(),
      this.prisma.event.findFirst({
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      }),
    ]);
    return {
      appEnv: resolveAppEnv({
        APP_ENV: this.config.get<string>('APP_ENV'),
        NODE_ENV: this.config.get<string>('NODE_ENV'),
      }),
      node: process.version,
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(memory.rss / 1024 / 1024),
      database,
      liveBoardConnections: this.hub.connections,
      integrations: {
        ai: this.ai.configured,
        email: has('RESEND_API_KEY'),
        images: has('CLOUDINARY_CLOUD_NAME'),
      },
      counts: { users, restaurants, events },
      lastEventAt: lastEvent?.occurredAt ?? null,
    };
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
