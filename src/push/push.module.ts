import { Module } from '@nestjs/common';
import { PushController } from './push.controller';

// PushService itself is global (SharedModule): orders and service calls use it.
@Module({ controllers: [PushController] })
export class PushModule {}
