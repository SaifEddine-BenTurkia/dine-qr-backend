import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CurrentUser,
  ForRole,
  JwtAuthGuard,
  type AuthUser,
} from '../common/auth.guard';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { PushService } from './push.service';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

class PushKeysDto {
  @Matches(BASE64URL)
  @MaxLength(200)
  p256dh: string;

  @Matches(BASE64URL)
  @MaxLength(100)
  auth: string;
}

class EndpointDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @IsString()
  @MaxLength(1000)
  endpoint: string;
}

class SubscribeDto extends EndpointDto {
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

/** Notifications for the owner's and staff's devices (O-06). */
@ForRole('restaurant', 'staff')
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly access: RestaurantAccessService,
  ) {}

  @Get('key')
  key() {
    return this.push.publicKey();
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('subscribe')
  async subscribe(@CurrentUser() user: AuthUser, @Body() body: SubscribeDto) {
    const restaurantId = await this.access.restaurantIdFor(user.id);
    return this.push.subscribe(
      {
        restaurantId,
        staffId: user.staff ? user.id : null,
        role: user.staff?.role ?? 'OWNER',
      },
      { endpoint: body.endpoint, keys: body.keys },
    );
  }

  @HttpCode(204)
  @Post('unsubscribe')
  async unsubscribe(@CurrentUser() user: AuthUser, @Body() body: EndpointDto) {
    const restaurantId = await this.access.restaurantIdFor(user.id);
    await this.push.unsubscribe(restaurantId, body.endpoint);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(200)
  @Post('test')
  async test(@CurrentUser() user: AuthUser, @Body() body: EndpointDto) {
    const restaurantId = await this.access.restaurantIdFor(user.id);
    return this.push.test(restaurantId, body.endpoint);
  }
}
