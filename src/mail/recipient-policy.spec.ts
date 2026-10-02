import { ConfigService } from '@nestjs/config';
import { maskRecipient, RecipientPolicy } from './recipient-policy';

const policy = (values: Record<string, string>) =>
  new RecipientPolicy(new ConfigService(values));

describe('RecipientPolicy', () => {
  it('lets everything through in production', () => {
    const p = policy({ APP_ENV: 'production', NODE_ENV: 'production' });
    expect(p.allows('anyone@example.com')).toBe(true);
  });

  it('only allows the sandbox list before launch, ignoring case', () => {
    const p = policy({
      NODE_ENV: 'production',
      SANDBOX_ALLOWED_RECIPIENTS: 'Owner@Example.com, +21612345678',
      ADMIN_EMAILS: 'admin@example.com',
    });
    expect(p.appEnv).toBe('prelaunch');
    expect(p.allows('owner@example.com')).toBe(true);
    expect(p.allows('+21612345678')).toBe(true);
    expect(p.allows('admin@example.com')).toBe(false);
    expect(p.allows('customer@example.com')).toBe(false);
  });

  it('falls back to the admins when the sandbox list is empty', () => {
    const p = policy({ ADMIN_EMAILS: 'admin@example.com' });
    expect(p.allows('admin@example.com')).toBe(true);
    expect(p.allows('customer@example.com')).toBe(false);
  });
});

describe('maskRecipient', () => {
  it('hides the local part and most of a phone number', () => {
    expect(maskRecipient('jane.doe@example.com')).toBe('j***@example.com');
    expect(maskRecipient('+21612345678')).toBe('***678');
  });
});
