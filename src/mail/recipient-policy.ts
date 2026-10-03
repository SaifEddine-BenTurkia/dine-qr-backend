import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv, isSandbox, resolveAppEnv } from '../config/app-env';

const parseList = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/**
 * `account`: the email confirmation and password reset a person asks for
 * themselves, sent to the address they typed. `notice`: everything else.
 */
export type MailKind = 'account' | 'notice';

/**
 * Outbound allowlist (PLAN section 20, guard 3). Outside production, email
 * and WhatsApp messages only reach SANDBOX_ALLOWED_RECIPIENTS, so a test on
 * the VPS can never write to a real person. When that list is empty the
 * platform admins are the allowlist, which lets the owner keep testing.
 *
 * Account emails are the exception (owner decision, 2026-10-03, with open
 * sign-up): they go to the person who asked for them. ACCOUNT_EMAILS=allowlist
 * puts them back behind the allowlist.
 */
@Injectable()
export class RecipientPolicy {
  readonly appEnv: AppEnv;
  readonly accountEmailsOpen: boolean;
  private readonly allowed: Set<string>;

  constructor(config: ConfigService) {
    this.appEnv = resolveAppEnv({
      APP_ENV: config.get<string>('APP_ENV'),
      NODE_ENV: config.get<string>('NODE_ENV'),
    });
    this.accountEmailsOpen =
      config.get<string>('ACCOUNT_EMAILS')?.trim() !== 'allowlist';
    const sandbox = parseList(config.get<string>('SANDBOX_ALLOWED_RECIPIENTS'));
    this.allowed = new Set(
      sandbox.length > 0
        ? sandbox
        : parseList(config.get<string>('ADMIN_EMAILS')),
    );
  }

  /** Email address or E.164 phone number. */
  allows(recipient: string, kind: MailKind = 'notice'): boolean {
    if (!isSandbox(this.appEnv)) return true;
    if (kind === 'account' && this.accountEmailsOpen) return true;
    return this.allowed.has(recipient.trim().toLowerCase());
  }
}

/** `jane.doe@example.com` → `j***@example.com`, for logs. */
export function maskRecipient(recipient: string): string {
  const at = recipient.indexOf('@');
  if (at > 0) return `${recipient[0]}***${recipient.slice(at)}`;
  return recipient.length > 4 ? `***${recipient.slice(-3)}` : '***';
}
