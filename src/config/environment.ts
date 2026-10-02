import { modeProblems } from './app-env';

type Environment = Record<string, string | undefined>;

// Everything the API needs to serve real users. Missing values are tolerated in
// development so the app can boot without every third-party account, but a
// production container refuses to start rather than fail on the first request.
export const productionRequired = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'CORS_ORIGINS',
  'SCAN_HASH_SALT',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'OPENROUTER_API_KEYS',
  // Who can confirm cash payments, and who is emailed about new requests.
  'ADMIN_EMAILS',
] as const;

const runtimeRequired = ['DATABASE_URL', 'JWT_SECRET'] as const;

const secretKeys = ['JWT_SECRET', 'SCAN_HASH_SALT'] as const;

export function validateEnvironment(environment: Environment): Environment {
  const missingRuntime = runtimeRequired.filter(
    (key) => !environment[key]?.trim(),
  );
  if (missingRuntime.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingRuntime.join(', ')}`,
    );
  }

  // Sandbox guard (PLAN section 20): a sandbox deployment never carries live
  // provider settings, and production never carries sandbox ones.
  const modes = modeProblems(environment);
  if (modes.length > 0) {
    throw new Error(`Environment mode check failed: ${modes.join('; ')}`);
  }

  if (environment.NODE_ENV !== 'production') {
    return environment;
  }

  const missing = productionRequired.filter((key) => !environment[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`,
    );
  }

  const weak = secretKeys.filter(
    (key) => (environment[key]?.trim().length ?? 0) < 32,
  );
  if (weak.length > 0) {
    throw new Error(
      `Production secrets must contain at least 32 characters: ${weak.join(', ')}`,
    );
  }

  return environment;
}
