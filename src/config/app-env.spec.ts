import { modeProblems, resolveAppEnv } from './app-env';
import { validateEnvironment } from './environment';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(40),
};

describe('resolveAppEnv', () => {
  it('defaults to development locally and prelaunch on a production build', () => {
    expect(resolveAppEnv({})).toBe('development');
    expect(resolveAppEnv({ NODE_ENV: 'production' })).toBe('prelaunch');
  });

  it('rejects unknown values', () => {
    expect(() => resolveAppEnv({ APP_ENV: 'staging' })).toThrow(/APP_ENV/);
  });
});

describe('modeProblems', () => {
  it('accepts sandbox settings in development', () => {
    expect(
      modeProblems({
        FLOUCI_ENV: 'test',
        KONNECT_API_URL: 'https://api.sandbox.konnect.network/api/v2',
        GOOGLE_REVIEWS_WRITE_MODE: 'dry_run',
      }),
    ).toEqual([]);
  });

  it('fails on a planted live payment URL before launch', () => {
    const problems = modeProblems({
      APP_ENV: 'prelaunch',
      NODE_ENV: 'production',
      KONNECT_API_URL: 'https://api.konnect.network/api/v2',
    });
    expect(problems).toEqual([
      expect.stringContaining('KONNECT_API_URL must use the sandbox host'),
    ]);
  });

  it('fails on live flouci mode, live review replies and live-looking keys', () => {
    const problems = modeProblems({
      FLOUCI_ENV: 'live',
      GOOGLE_REVIEWS_WRITE_MODE: 'publish',
      SOME_KEY: 'sk_live_abcdefgh',
    });
    expect(problems).toHaveLength(3);
    expect(problems.join(' ')).not.toContain('abcdefgh');
  });

  it('refuses sandbox markers in production', () => {
    const problems = modeProblems({
      APP_ENV: 'production',
      NODE_ENV: 'production',
      FLOUCI_ENV: 'test',
      KONNECT_API_URL: 'https://api.sandbox.konnect.network/api/v2',
      GOOGLE_REVIEWS_WRITE_MODE: 'dry_run',
    });
    expect(problems).toHaveLength(3);
  });

  it('needs NODE_ENV=production for APP_ENV=production', () => {
    expect(modeProblems({ APP_ENV: 'production' })).toEqual([
      'APP_ENV production requires NODE_ENV=production',
    ]);
  });

  it('stops the API from booting', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        KONNECT_API_URL: 'https://api.konnect.network',
      }),
    ).toThrow(/mode check failed/);
  });
});
