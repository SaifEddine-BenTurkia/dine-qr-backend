import { Module } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ServiceModule } from '../service/service.module';
import { StockModule } from '../stock/stock.module';
import { PublicMenuController } from './public-menu.controller';
import { PublicMenuService } from './public-menu.service';

@Module({
  imports: [ServiceModule, LoyaltyModule, StockModule],
  controllers: [PublicMenuController],
  providers: [PublicMenuService],
})
export class PublicMenuModule {}
