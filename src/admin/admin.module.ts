import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { ServiceModule } from '../service/service.module';
import { AdminActivityService } from './admin-activity.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [BillingModule, ServiceModule, AiModule],
  controllers: [AdminController],
  providers: [AdminService, AdminActivityService],
})
export class AdminModule {}
