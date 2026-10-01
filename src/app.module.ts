import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ClientIpThrottlerGuard } from './common/client-ip-throttler.guard';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { InsightsModule } from './insights/insights.module';
import { MediaModule } from './media/media.module';
import { MenuModule } from './menu/menu.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { SharedModule } from './shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    // Backstop for every route. Endpoints that guard credentials, inboxes or
    // paid quotas set much tighter limits with @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    SharedModule,
    HealthModule,
    AuthModule,
    RestaurantModule,
    MenuModule,
    MediaModule,
    PublicMenuModule,
    BillingModule,
    InsightsModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
