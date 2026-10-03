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
import { PaymentContactMethod, PaymentRequestStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AdminGuard } from '../common/admin';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  type AuthUser,
} from '../common/auth.guard';
import { BillingService } from './billing.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class CreatePaymentRequestDto {
  @IsInt()
  @Min(1)
  @Max(24)
  months: number;

  @IsEnum(PaymentContactMethod)
  contactMethod: PaymentContactMethod;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class AdminListQuery {
  @IsOptional()
  @IsEnum(PaymentRequestStatus)
  status?: PaymentRequestStatus;
}

class MarkPaidDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  amountReceived?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

class RejectDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.billing.get(user.id);
  }

  @HttpCode(200)
  @Post('start-trial')
  startTrial(@CurrentUser() user: AuthUser) {
    return this.billing.startTrial(user.id);
  }

  @Get('payment-requests')
  listRequests(@CurrentUser() user: AuthUser) {
    return this.billing.listMyRequests(user.id);
  }

  // Each request emails the admins, so it is limited well below browsing.
  @Throttle({ default: { ttl: 60 * 60_000, limit: 10 } })
  @Post('payment-requests')
  createRequest(
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePaymentRequestDto,
  ) {
    return this.billing.createPaymentRequest(user.id, body);
  }

  @HttpCode(204)
  @Post('payment-requests/:id/cancel')
  cancelRequest(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.cancelPaymentRequest(user.id, id);
  }
}

@ForRole('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/payment-requests')
export class AdminPaymentsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  list(@Query() query: AdminListQuery) {
    return this.billing.adminList(query.status);
  }

  @HttpCode(200)
  @Post(':id/mark-paid')
  markPaid(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MarkPaidDto,
  ) {
    return this.billing.markPaid(id, admin.email, body);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectDto,
  ) {
    return this.billing.reject(id, admin.email, body.adminNote);
  }
}
