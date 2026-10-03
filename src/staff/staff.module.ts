import { Module } from '@nestjs/common';
import { StaffAuthController, StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  controllers: [StaffController, StaffAuthController],
  providers: [StaffService],
})
export class StaffModule {}
