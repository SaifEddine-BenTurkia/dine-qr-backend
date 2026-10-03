import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  StaffRoles,
  type AuthUser,
} from '../common/auth.guard';
import { StockService } from './stock.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const WHEN = /^(today|tomorrow|week|\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?)$/;

class TrackDto {
  @IsBoolean()
  track: boolean;
}

class RestockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity: number;

  /** "today", "tomorrow" or a date: sold until the end of that day. */
  @IsOptional()
  @Matches(WHEN, { message: 'Date invalide' })
  expiresOn?: string;
}

class CountDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  quantity: number;
}

class WasteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reason?: string;
}

class PromoDto {
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(90)
  percent: number;

  @Matches(WHEN, { message: 'Date invalide' })
  until: string;
}

class MovementsQuery {
  @IsOptional()
  @IsUUID()
  dishId?: string;
}

const actorName = (user: AuthUser) => user.staff?.name ?? 'Responsable';

/** Stock and anti-waste (Business): the owner and managers. */
@ForRole('restaurant', 'staff')
@StaffRoles('MANAGER')
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.stock.overview(user.id);
  }

  @Get('movements')
  movements(@CurrentUser() user: AuthUser, @Query() query: MovementsQuery) {
    return this.stock.movements(user.id, query.dishId);
  }

  @HttpCode(200)
  @Post('dishes/:id/track')
  track(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TrackDto,
  ) {
    return this.stock.setTracking(user.id, id, body.track);
  }

  @HttpCode(200)
  @Post('dishes/:id/restock')
  restock(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RestockDto,
  ) {
    return this.stock.restock(user.id, id, body, actorName(user));
  }

  @HttpCode(200)
  @Post('dishes/:id/count')
  count(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CountDto,
  ) {
    return this.stock.count(user.id, id, body.quantity, actorName(user));
  }

  @HttpCode(200)
  @Post('dishes/:id/waste')
  waste(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WasteDto,
  ) {
    return this.stock.waste(user.id, id, body, actorName(user));
  }

  @HttpCode(200)
  @Post('dishes/:id/promo')
  promo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PromoDto,
  ) {
    return this.stock.setPromo(user.id, id, body);
  }

  @HttpCode(204)
  @Delete('dishes/:id/promo')
  async clearPromo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.stock.clearPromo(user.id, id);
  }
}
