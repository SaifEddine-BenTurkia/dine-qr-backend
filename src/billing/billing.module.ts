import { Module } from '@nestjs/common';
import {
  AdminPaymentsController,
  SubscriptionController,
} from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [SubscriptionController, AdminPaymentsController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
