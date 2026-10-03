import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  StaffRoles,
  type AuthUser,
} from '../common/auth.guard';
import { OrdersService } from './orders.service';

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class OrderLineDto {
  @IsUUID()
  dishId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}

class OrderLinesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'La commande est vide' })
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  items: OrderLineDto[];

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}

class GuestOrderDto extends OrderLinesDto {
  @Matches(ID)
  sessionId: string;

  @Matches(ID, { message: 'Scannez le QR code de votre table pour commander' })
  tableToken: string;
}

class CounterOrderDto extends OrderLinesDto {
  @IsOptional()
  @IsUUID()
  tableId?: string;
}

class SessionQuery {
  @Matches(ID)
  sessionId: string;
}

class RejectDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(140)
  reason?: string;
}

class PayDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  orderIds: string[];

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  discountMillimes?: number;

  @IsOptional()
  @IsUUID()
  loyaltyCardId?: string;
}

class DayQuery {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

const actorName = (user: AuthUser) => user.staff?.name ?? 'Responsable';

/** Guests order from the table (O-01). Needs the table's QR token. */
@Controller('public/menu')
export class PublicOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post(':slug/orders')
  create(@Param('slug') slug: string, @Body() body: GuestOrderDto) {
    return this.orders.createFromGuest(slug, body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':slug/orders')
  mine(@Param('slug') slug: string, @Query() query: SessionQuery) {
    return this.orders.guestOrders(slug, query.sessionId);
  }

  @HttpCode(200)
  @Post(':slug/orders/:id/cancel')
  cancel(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SessionQuery,
  ) {
    return this.orders.cancelFromGuest(slug, id, query.sessionId);
  }
}

/**
 * The caisse (O-02…O-05): owner, managers and cashiers run it; waiters and
 * kitchen see orders and move them along (ready, served).
 */
@ForRole('restaurant', 'staff')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.list(user.id);
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @Post('counter')
  counter(@CurrentUser() user: AuthUser, @Body() body: CounterOrderDto) {
    return this.orders.createAtCounter(user.id, actorName(user), body);
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @HttpCode(200)
  @Post(':id/accept')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.setStatus(user.id, id, 'ACCEPTED');
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectDto,
  ) {
    return this.orders.setStatus(user.id, id, 'REJECTED', body.reason);
  }

  @HttpCode(200)
  @Post(':id/ready')
  ready(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.setStatus(user.id, id, 'READY');
  }

  @HttpCode(200)
  @Post(':id/served')
  served(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.setStatus(user.id, id, 'SERVED');
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @Get('tabs')
  tabs(@CurrentUser() user: AuthUser) {
    return this.orders.openTabs(user.id);
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @Post('pay')
  pay(@CurrentUser() user: AuthUser, @Body() body: PayDto) {
    return this.orders.pay(user.id, actorName(user), body);
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @Get('bills/:id')
  receipt(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.receipt(user.id, id);
  }

  @StaffRoles('MANAGER', 'CASHIER')
  @Get('report/day')
  report(@CurrentUser() user: AuthUser, @Query() query: DayQuery) {
    return this.orders.dayReport(user.id, query.date);
  }
}
