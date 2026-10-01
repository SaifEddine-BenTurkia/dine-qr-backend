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
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingService } from '../billing/billing.service';
import type { EffectiveStatus } from '../billing/subscription-status';
import { AdminGuard } from '../common/admin';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { AdminService } from './admin.service';

const STATUSES: EffectiveStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'none',
];

class AccountsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: EffectiveStatus;
}

class RecordPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  amountReceived?: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

class ExtendTrialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly billing: BillingService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('accounts')
  accounts(@Query() query: AccountsQuery) {
    return this.admin.accounts(query.search, query.status);
  }

  @Get('accounts/:userId/payments')
  payments(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.accountPayments(userId);
  }

  @HttpCode(200)
  @Post('accounts/:userId/payments')
  recordPayment(
    @CurrentUser() admin: AuthUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: RecordPaymentDto,
  ) {
    return this.billing.recordCashPayment(userId, admin.email, body);
  }

  @HttpCode(200)
  @Post('accounts/:userId/extend-trial')
  extendTrial(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ExtendTrialDto,
  ) {
    return this.admin.extendTrial(userId, body.days);
  }

  @HttpCode(200)
  @Post('accounts/:userId/suspend')
  suspend(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.suspend(userId);
  }
}
