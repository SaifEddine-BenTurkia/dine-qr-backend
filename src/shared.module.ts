import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './common/auth.guard';
import { MailService } from './mail/mail.service';
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
  providers: [JwtAuthGuard, MailService, MediaService, RestaurantAccessService],
  exports: [
    JwtModule,
    JwtAuthGuard,
    MailService,
    MediaService,
    RestaurantAccessService,
  ],
})
export class SharedModule {}
