import { Module } from '@nestjs/common';
import { ServiceHub } from './service-hub';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  controllers: [ServiceRequestsController],
  providers: [ServiceHub, ServiceRequestsService],
  exports: [ServiceHub, ServiceRequestsService],
})
export class ServiceModule {}
