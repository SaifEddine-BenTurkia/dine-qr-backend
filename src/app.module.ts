import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ClientIpThrottlerGuard } from './common/client-ip-throttler.guard';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { InsightsModule } from './insights/insights.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MediaModule } from './media/media.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { PushModule } from './push/push.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { ServiceModule } from './service/service.module';
import { SharedModule } from './shared.module';
import { StockModule } from './stock/stock.module';
import { StaffModule } from './staff/staff.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Development keys live in .env.sandbox (PLAN section 20); .env is the
      // fallback for older setups. The first file wins for each variable.
      envFilePath: ['.env.sandbox', '.env'],
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
    TablesModule,
    StaffModule,
    OrdersModule,
    PushModule,
    LoyaltyModule,
    StockModule,
    ServiceModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
