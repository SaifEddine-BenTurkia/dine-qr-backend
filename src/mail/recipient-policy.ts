import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv, isSandbox, resolveAppEnv } from '../config/app-env';

const parseList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/**
 * Outbound allowlist (PLAN section 20, guard 3). Outside production, email
 * and WhatsApp messages only reach SANDBOX_ALLOWED_RECIPIENTS, so a test on
 * the VPS can never write to a real person. When that list is empty the
 * platform admins are the allowlist, which lets the owner keep testing.
 */
@Injectable()
export class RecipientPolicy {
  readonly appEnv: AppEnv;
  private readonly allowed: Set<string>;

  constructor(config: ConfigService) {
    this.appEnv = resolveAppEnv({
      APP_ENV: config.get<string>('APP_ENV'),
      NODE_ENV: config.get<string>('NODE_ENV'),
    });
    const sandbox = parseList(config.get<string>('SANDBOX_ALLOWED_RECIPIENTS'));
    this.allowed = new Set(
      sandbox.length > 0
        ? sandbox
        : parseList(config.get<string>('ADMIN_EMAILS')),
    );
  }

  /** Email address or E.164 phone number. */
  allows(recipient: string): boolean {
    if (!isSandbox(this.appEnv)) return true;
    return this.allowed.has(recipient.trim().toLowerCase());
  }
}

/** `jane.doe@example.com` → `j***@example.com`, for logs. */
export function maskRecipient(recipient: string): string {
  const at = recipient.indexOf('@');
  if (at > 0) return `${recipient[0]}***${recipient.slice(at)}`;
  return recipient.length > 4 ? `***${recipient.slice(-3)}` : '***';
}
