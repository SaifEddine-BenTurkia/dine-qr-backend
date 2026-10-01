import { Module } from '@nestjs/common';
import {
  PaddleWebhookController,
  SubscriptionController,
} from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [SubscriptionController, PaddleWebhookController],
  providers: [BillingService],
})
export class BillingModule {}
