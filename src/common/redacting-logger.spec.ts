import { redact, secretValues } from './redacting-logger';

describe('redact', () => {
  const secrets = secretValues({
    RESEND_API_KEY: 'plain-secret-value-1',
    OPENROUTER_API_KEYS: 'key-number-one,key-number-two',
    FRONTEND_URL: 'https://menu.example.com',
    SHORT_TOKEN: 'abc',
  });

  it('masks secret env values, including each item of a list', () => {
    const out = redact('a plain-secret-value-1 b key-number-two c', secrets);
    expect(out).toBe('a [redacted] b [redacted] c');
  });

  it('keeps non-secret values and very short ones', () => {
    expect(secrets).not.toContain('https://menu.example.com');
    expect(secrets).not.toContain('abc');
  });

  it('masks known key formats, bearer tokens, database passwords and emails', () => {
    const out = redact(
      'sk-or-v1-0123456789abcdef re_ABCDEFGHIJKLMNOPQRST Bearer eyJhbGciOi.payload postgresql://user:pw@db:5432/x jane.doe@example.com',
      [],
    );
    expect(out).toBe(
      'sk-or-v1-[redacted] re_[redacted] Bearer [redacted] postgresql://user:[redacted]@db:5432/x j***@example.com',
    );
  });
});
