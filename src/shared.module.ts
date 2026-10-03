import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EntitlementsService } from './billing/entitlements.service';
import { AdminAccess, AdminGuard } from './common/admin';
import { JwtAuthGuard } from './common/auth.guard';
import { MailService } from './mail/mail.service';
import { RecipientPolicy } from './mail/recipient-policy';
import { MediaService } from './media/media.service';
import { RestaurantAccessService } from './restaurant/restaurant-access.service';

// Services every feature module uses, registered once.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d',
        } as never,
      }),
    }),
  ],
  providers: [
    JwtAuthGuard,
    AdminAccess,
    AdminGuard,
    MailService,
    RecipientPolicy,
    MediaService,
    RestaurantAccessService,
    EntitlementsService,
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,
    AdminAccess,
    AdminGuard,
    MailService,
    RecipientPolicy,
    MediaService,
    RestaurantAccessService,
    EntitlementsService,
  ],
})
export class SharedModule {}
