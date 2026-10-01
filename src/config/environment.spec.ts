import { validateEnvironment } from './environment';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(40),
};

const fullProduction = {
  ...base,
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://menu.example.com',
  CORS_ORIGINS: 'https://menu.example.com',
  SCAN_HASH_SALT: 'y'.repeat(40),
  RESEND_API_KEY: 'k',
  RESEND_FROM_EMAIL: 'a@b.c',
  CLOUDINARY_CLOUD_NAME: 'c',
  CLOUDINARY_API_KEY: 'c',
  CLOUDINARY_API_SECRET: 'c',
  PADDLE_API_KEY: 'p',
  PADDLE_WEBHOOK_SECRET: 'p',
  OPENROUTER_API_KEYS: 'o',
};

describe('validateEnvironment', () => {
  it('accepts a minimal development environment', () => {
    expect(() => validateEnvironment({ ...base })).not.toThrow();
  });

  it('requires the database and JWT secret everywhere', () => {
    expect(() => validateEnvironment({ JWT_SECRET: 'x' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects an unknown Paddle environment', () => {
    expect(() => validateEnvironment({ ...base, PADDLE_ENV: 'live' })).toThrow(
      /PADDLE_ENV/,
    );
  });

  it('lists missing production variables', () => {
    expect(() =>
      validateEnvironment({ ...base, NODE_ENV: 'production' }),
    ).toThrow(/PADDLE_API_KEY/);
  });

  it('rejects short production secrets', () => {
    expect(() =>
      validateEnvironment({ ...fullProduction, JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('accepts a complete production environment', () => {
    expect(() => validateEnvironment(fullProduction)).not.toThrow();
  });
});
