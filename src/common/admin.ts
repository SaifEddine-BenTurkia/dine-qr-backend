import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AuthUser } from './auth.guard';

/**
 * Admins are the accounts whose email is listed in ADMIN_EMAILS. Keeping the
 * list in server configuration means there is no signup path or database flag
 * that could be abused to become one.
 */
@Injectable()
export class AdminAccess {
  private readonly emails: Set<string>;

  constructor(config: ConfigService) {
    this.emails = new Set(
      (config.get<string>('ADMIN_EMAILS') ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  isAdmin(email: string) {
    return this.emails.has(email.toLowerCase());
  }

  /** Where new payment requests are announced. */
  notificationEmails() {
    return [...this.emails];
  }
}

/** Use after JwtAuthGuard: `@UseGuards(JwtAuthGuard, AdminGuard)`. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly admins: AdminAccess) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!req.user || !this.admins.isAdmin(req.user.email)) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    return true;
  }
}
