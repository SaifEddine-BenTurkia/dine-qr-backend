import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  AllowQueryToken,
  CurrentUser,
  JwtAuthGuard,
  type AuthUser,
} from '../common/auth.guard';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { ServiceHub } from './service-hub';
import { ServiceRequestsService } from './service-requests.service';

class StatsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days: number = 7;
}

/** The staff live board (P1-06). */
@UseGuards(JwtAuthGuard)
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(
    private readonly requests: ServiceRequestsService,
    private readonly access: RestaurantAccessService,
    private readonly hub: ServiceHub,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.requests.listActive(user.id);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser, @Query() query: StatsQuery) {
    return this.requests.stats(user.id, query.days);
  }

  // Responses must not be buffered by nginx, or events arrive in batches.
  @SkipThrottle()
  @AllowQueryToken()
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Sse('stream')
  async stream(@CurrentUser() user: AuthUser) {
    const restaurantId = await this.access.restaurantIdFor(user.id);
    return this.hub.stream(restaurantId);
  }

  @Post(':id/acknowledge')
  acknowledge(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.requests.acknowledge(user.id, id);
  }

  @Post(':id/done')
  done(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.requests.done(user.id, id);
  }
}
