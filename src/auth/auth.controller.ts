import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AllowUnverifiedEmail,
  CurrentUser,
  JwtAuthGuard,
  type AuthUser,
} from '../common/auth.guard';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailQueryDto,
} from './auth.dto';
import { AuthService } from './auth.service';

// Credential and email endpoints get a much tighter limit than the global one:
// they are the targets for password guessing and for spamming inboxes.
const STRICT = { default: { ttl: 60_000, limit: 5 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle(STRICT)
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @UseGuards(JwtAuthGuard)
  @AllowUnverifiedEmail()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Throttle(STRICT)
  @Get('verify-email')
  verifyEmail(@Query() query: VerifyEmailQueryDto) {
    return this.auth.verifyEmail(query.token);
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('resend-verification')
  resendVerification(@Body() body: EmailDto) {
    return this.auth.resendVerification(body.email);
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() body: EmailDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.password);
  }
}
