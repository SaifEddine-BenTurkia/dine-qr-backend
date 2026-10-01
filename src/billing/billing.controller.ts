import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { BillingService } from './billing.service';
import { verifyPaddleSignature, type PaddleSubscriptionEvent } from './paddle';

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

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser) {
    return this.billing.checkout(user.id);
  }

  @HttpCode(204)
  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser) {
    return this.billing.cancel(user.id);
  }
}

@SkipThrottle()
@Controller('webhooks')
export class PaddleWebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @HttpCode(200)
  @Post('paddle')
  async paddle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paddle-signature') signature: string | undefined,
  ) {
    const secret = this.config.get<string>('PADDLE_WEBHOOK_SECRET') ?? '';
    if (
      !req.rawBody ||
      !verifyPaddleSignature(signature, req.rawBody, secret)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }
    await this.billing.handleWebhook(
      JSON.parse(req.rawBody.toString('utf8')) as PaddleSubscriptionEvent,
    );
    return { received: true };
  }
}
