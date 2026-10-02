/**
 * npm run env:init
 *
 * Creates the local sandbox env file when it is missing, with generated
 * secrets and local defaults, and adds generated secrets that are missing
 * from an existing one. Never prints a value and never overwrites a key.
 * Third-party keys are left for the owner to paste (PLAN section 18).
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { namesIn } from './load-env';

const FILE = '.env.sandbox';

const generated: Record<string, () => string> = {
  JWT_SECRET: () => randomBytes(48).toString('hex'),
  SCAN_HASH_SALT: () => randomBytes(32).toString('hex'),
  SECRETS_ENCRYPTION_KEY: () => randomBytes(32).toString('base64'),
  WA_VERIFY_TOKEN: () => randomBytes(24).toString('hex'),
};

const defaults: Record<string, string> = {
  APP_ENV: 'development',
  NODE_ENV: 'development',
  PORT: '3001',
  FRONTEND_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://tableqr:tableqr@localhost:5434/tableqr',
  JWT_EXPIRES_IN: '7d',
  TRIAL_DAYS: '30',
  RESEND_FROM_EMAIL: 'TableQR <onboarding@resend.dev>',
  CLOUDINARY_FOLDER: 'tableqr-dev',
  GOOGLE_REVIEWS_WRITE_MODE: 'dry_run',
  FLOUCI_ENV: 'test',
};

// Left as comments: the owner pastes these (sandbox or capped keys only).
const ownerFilled = [
  'SANDBOX_ALLOWED_RECIPIENTS',
  'ADMIN_EMAILS',
  'RESEND_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_LIBRARY_FOLDER',
  'OPENROUTER_API_KEYS',
  'LLM_MODEL_SMART',
  'LLM_MODEL_FAST',
  'PAYMENT_WHATSAPP',
  'PAYMENT_CONTACT_EMAIL',
  'PAYMENT_PHONE',
  'WA_PHONE_NUMBER_ID',
  'WA_BUSINESS_ACCOUNT_ID',
  'WA_ACCESS_TOKEN',
  'WA_APP_SECRET',
  'WA_GRAPH_VERSION',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'FLOUCI_PUBLIC_KEY',
  'FLOUCI_PRIVATE_KEY',
  'KONNECT_API_URL',
  'KONNECT_API_KEY',
  'KONNECT_WALLET_ID',
  'BACKUP_S3_ENDPOINT',
  'BACKUP_S3_BUCKET',
  'BACKUP_S3_ACCESS_KEY',
  'BACKUP_S3_SECRET_KEY',
];

if (!existsSync(FILE)) {
  const body = [
    '# TableQR development keys (PLAN section 20). Sandbox or capped keys only.',
    '# Created by `npm run env:init`. Uncomment a line and paste the value.',
    '',
    ...Object.entries(defaults).map(([k, v]) => `${k}=${v}`),
    ...Object.entries(generated).map(([k, make]) => `${k}=${make()}`),
    '',
    ...ownerFilled.map((name) => `# ${name}=`),
    '',
  ].join('\n');
  writeFileSync(FILE, body, { mode: 0o600 });
  console.log(`created ${FILE}: defaults and generated secrets written`);
} else {
  const present = new Set(namesIn(FILE));
  const missing = Object.keys(generated).filter((name) => !present.has(name));
  for (const name of missing) {
    appendFileSync(FILE, `\n${name}=${generated[name]()}\n`);
  }
  console.log(
    missing.length
      ? `added to ${FILE}: ${missing.join(', ')}`
      : `${FILE} already has every generated secret`,
  );
}
