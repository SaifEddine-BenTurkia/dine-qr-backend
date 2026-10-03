import { mustVerifyEmail } from './auth.guard';

describe('mustVerifyEmail', () => {
  it('lets a restaurant account in before its email is confirmed (open sign-up)', () => {
    expect(
      mustVerifyEmail({ verified: false, role: 'restaurant', strict: false }),
    ).toBe(false);
  });

  it('always asks an admin account to confirm its email first', () => {
    expect(
      mustVerifyEmail({ verified: false, role: 'admin', strict: false }),
    ).toBe(true);
  });

  it('asks everyone when REQUIRE_EMAIL_VERIFICATION is on', () => {
    expect(
      mustVerifyEmail({ verified: false, role: 'restaurant', strict: true }),
    ).toBe(true);
  });

  it('never blocks a confirmed email', () => {
    for (const role of ['admin', 'restaurant'] as const) {
      expect(mustVerifyEmail({ verified: true, role, strict: true })).toBe(
        false,
      );
    }
  });
});
