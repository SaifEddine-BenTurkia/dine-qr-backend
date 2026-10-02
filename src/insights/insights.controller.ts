import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';

class ScanStatsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number = 7;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class InsightsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
  ) {}

  /** Scans per day for the last N days, oldest first, with empty days as 0. */
  @Get('stats/scans')
  async scans(@CurrentUser() user: AuthUser, @Query() query: ScanStatsQuery) {
    const restaurantId = await this.access.restaurantIdOrNull(user.id);
    if (!restaurantId) return [];
    const rows = await this.prisma.$queryRaw<{ date: string; count: number }[]>(
      Prisma.sql`
        SELECT to_char(day, 'YYYY-MM-DD') AS date, COALESCE(s.count, 0)::int AS count
        FROM generate_series(
          (now() AT TIME ZONE 'UTC')::date - (${query.days}::int - 1),
          (now() AT TIME ZONE 'UTC')::date,
          interval '1 day'
        ) AS day
        LEFT JOIN (
          SELECT ("createdAt" AT TIME ZONE 'UTC')::date AS d, count(*) AS count
          FROM "Scan"
          WHERE "restaurantId" = ${restaurantId}
            AND "createdAt" >= now() - (${query.days}::int * interval '1 day')
          GROUP BY 1
        ) s ON s.d = day
        ORDER BY day`,
    );
    return rows;
  }

  /**
   * Owner dashboard (P1-09): what TableQR did for the restaurant over the
   * last N days, from the events table. Counts only, never estimates.
   */
  @Get('stats/overview')
  async overview(
    @CurrentUser() user: AuthUser,
    @Query() query: ScanStatsQuery,
  ) {
    const restaurantId = await this.access.restaurantIdOrNull(user.id);
    if (!restaurantId) return null;
    const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const where = { restaurantId, occurredAt: { gte: since } };

    const [byType, sessions, requests, feedback, scans, menuUpdates] =
      await Promise.all([
        this.prisma.event.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
          SELECT count(DISTINCT "sessionId")::int AS count FROM "Event"
          WHERE "restaurantId" = ${restaurantId} AND "occurredAt" >= ${since}
            AND type = 'menu_opened'`),
        this.prisma.$queryRaw<
          { total: number; handled: number; avgSeconds: number | null }[]
        >(Prisma.sql`
          SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE status = 'DONE')::int AS handled,
                 round(avg(extract(epoch FROM ("acknowledgedAt" - "createdAt"))))::int AS "avgSeconds"
          FROM "ServiceRequest"
          WHERE "restaurantId" = ${restaurantId} AND "createdAt" >= ${since}`),
        this.prisma.feedback.aggregate({
          where: { restaurantId, createdAt: { gte: since } },
          _count: { _all: true },
          _avg: { rating: true },
        }),
        this.prisma.scan.count({
          where: { restaurantId, createdAt: { gte: since } },
        }),
        this.prisma.dish.count({
          where: { category: { restaurantId }, updatedAt: { gte: since } },
        }),
      ]);

    const [languages, heatmap, items] = await Promise.all([
      this.prisma.$queryRaw<{ locale: string; count: number }[]>(Prisma.sql`
        SELECT COALESCE(props->>'locale', 'fr') AS locale, count(*)::int AS count
        FROM "Event"
        WHERE "restaurantId" = ${restaurantId} AND "occurredAt" >= ${since}
          AND type = 'menu_opened'
        GROUP BY 1 ORDER BY 2 DESC`),
      // Day of week (1 = Monday) x hour, in Tunis time.
      this.prisma.$queryRaw<{ dow: number; hour: number; count: number }[]>(
        Prisma.sql`
        SELECT extract(isodow FROM t)::int AS dow, extract(hour FROM t)::int AS hour,
               count(*)::int AS count
        FROM (SELECT "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis' AS t
              FROM "Event"
              WHERE "restaurantId" = ${restaurantId} AND "occurredAt" >= ${since}
                AND type = 'menu_opened') e
        GROUP BY 1, 2`,
      ),
      this.prisma.$queryRaw<
        { id: string; name: string; views: number; adds: number }[]
      >(Prisma.sql`
        SELECT d.id, d.name,
               count(*) FILTER (WHERE e.type = 'item_viewed')::int AS views,
               count(*) FILTER (WHERE e.type = 'selection_item_added')::int AS adds
        FROM "Event" e JOIN "Dish" d ON d.id = e."itemId"
        WHERE e."restaurantId" = ${restaurantId} AND e."occurredAt" >= ${since}
          AND e.type IN ('item_viewed', 'selection_item_added')
        GROUP BY d.id, d.name
        ORDER BY views DESC, adds DESC
        LIMIT 50`),
    ]);

    const count = (type: string) =>
      byType.find((row) => row.type === type)?._count._all ?? 0;
    return {
      days: query.days,
      scans,
      guestSessions: sessions[0]?.count ?? 0,
      menuOpens: count('menu_opened'),
      itemViews: count('item_viewed'),
      selectionAdds: count('selection_item_added'),
      wifiViews: count('wifi_viewed'),
      googleReviewClicks: count('google_review_clicked'),
      serviceRequests: requests[0]?.total ?? 0,
      serviceHandled: requests[0]?.handled ?? 0,
      avgResponseSeconds: requests[0]?.avgSeconds ?? null,
      feedbackCount: feedback._count._all,
      feedbackAverage: feedback._avg.rating,
      menuUpdates,
      languages,
      heatmap,
      topItems: items.slice(0, 5),
      // Viewed often, rarely added to a selection: candidates for a better
      // photo or description.
      lowConversion: items
        .filter((item) => item.views >= 5 && item.adds / item.views < 0.1)
        .slice(0, 5),
    };
  }

  @Get('restaurants/feedback')
  async feedback(@CurrentUser() user: AuthUser) {
    const restaurantId = await this.access.restaurantIdOrNull(user.id);
    if (!restaurantId) return [];
    return this.prisma.feedback.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        rating: true,
        comment: true,
        tags: true,
        tableLabel: true,
        contactConsent: true,
        contact: true,
        createdAt: true,
      },
    });
  }
}
