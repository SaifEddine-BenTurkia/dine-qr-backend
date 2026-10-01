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

  @Get('restaurants/feedback')
  async feedback(@CurrentUser() user: AuthUser) {
    const restaurantId = await this.access.restaurantIdOrNull(user.id);
    if (!restaurantId) return [];
    return this.prisma.feedback.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
  }
}
