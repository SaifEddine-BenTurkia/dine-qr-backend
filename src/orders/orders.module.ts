import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ServiceModule } from '../service/service.module';
import { StockModule } from '../stock/stock.module';
import { OrdersController, PublicOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ServiceModule, LoyaltyModule, StockModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
