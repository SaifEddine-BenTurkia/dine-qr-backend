import { Module } from '@nestjs/common';
import { ServiceModule } from '../service/service.module';
import { PublicMenuController } from './public-menu.controller';
import { PublicMenuService } from './public-menu.service';

@Module({
  imports: [ServiceModule],
  controllers: [PublicMenuController],
  providers: [PublicMenuService],
})
export class PublicMenuModule {}
