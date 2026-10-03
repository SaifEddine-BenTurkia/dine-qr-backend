import { Module } from '@nestjs/common';
import { ServiceModule } from '../service/service.module';
import { OrdersController, PublicOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ServiceModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
