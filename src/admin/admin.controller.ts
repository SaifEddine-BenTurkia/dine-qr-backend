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
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BillingService } from '../billing/billing.service';
import { PLAN_IDS, type PlanId } from '../billing/plan-catalog';
import type { EffectiveStatus } from '../billing/subscription-status';
import { AdminGuard } from '../common/admin';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  type AuthUser,
} from '../common/auth.guard';
import { GoogleWalletService } from '../loyalty/wallet.service';
import { MailService } from '../mail/mail.service';
import { AdminActivityService } from './admin-activity.service';
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
  @IsIn(PLAN_IDS)
  plan?: PlanId;

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

class ActivityQuery {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 7, 30, 90])
  days: number = 7;
}

class CreateAccountDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  /** Moves this restaurant, owned today by an admin account, to the new account. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  takeOverSlug?: string;
}

class SetPlanDto {
  @IsIn(PLAN_IDS)
  plan: PlanId;
}

class TestEmailDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  to?: string;
}

class ExtendTrialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;
}

@ForRole('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly billing: BillingService,
    private readonly activityService: AdminActivityService,
    private readonly mail: MailService,
    private readonly wallet: GoogleWalletService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('activity')
  activity(@Query() query: ActivityQuery) {
    return this.activityService.activity(query.days);
  }

  @Get('system')
  system() {
    return this.activityService.system();
  }

  /** Sends a test email (to the admin, or another address) and returns Resend's answer. */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('system/test-email')
  testEmail(@CurrentUser() user: AuthUser, @Body() body: TestEmailDto) {
    return this.mail.sendTest(body.to ?? user.email);
  }

  /** Signs in to Google Wallet and returns a test pass to save. */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('system/test-wallet')
  testWallet() {
    return this.wallet.testPass();
  }

  @Get('accounts')
  accounts(@Query() query: AccountsQuery) {
    return this.admin.accounts(query.search, query.status);
  }

  @Post('accounts')
  createAccount(@Body() body: CreateAccountDto) {
    return this.admin.createRestaurantAccount(body);
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
  @Post('accounts/:userId/plan')
  setPlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: SetPlanDto,
  ) {
    return this.billing.setPlan(userId, body.plan);
  }

  @HttpCode(200)
  @Post('accounts/:userId/extend-trial')
  extendTrial(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: ExtendTrialDto,
  ) {
    return this.admin.extendTrial(userId, body.days);
  }

  /** For owners who cannot receive the link (prelaunch email allowlist, typos). */
  @HttpCode(200)
  @Post('accounts/:userId/verify-email')
  verifyEmail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.verifyEmail(userId);
  }

  @HttpCode(200)
  @Post('accounts/:userId/suspend')
  suspend(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.admin.suspend(userId);
  }
}
