/**
 * npm run env:check [-- --file <path>]
 *
 * Sandbox guard 1 (PLAN section 20). Prints variable names and verdicts,
 * never values. Exit code 1 when something must be fixed.
 */
import { modeProblems, resolveAppEnv } from '../src/config/app-env';
import { productionRequired } from '../src/config/environment';
import { loadEnv, namesIn } from './load-env';

// Every variable the code reads or the plan reserves (PLAN section 20).
const KNOWN = new Set([
  'APP_ENV',
  'SANDBOX_ALLOWED_RECIPIENTS',
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'CORS_ORIGINS',
  'DATABASE_URL',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'SCAN_HASH_SALT',
  'ADMIN_EMAILS',
  'REQUIRE_EMAIL_VERIFICATION',
  'ACCOUNT_EMAILS',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_FOLDER',
  'CLOUDINARY_LIBRARY_FOLDER',
  'OPENROUTER_API_KEYS',
  'OPENROUTER_MODEL',
  'LLM_MODEL_SMART',
  'LLM_MODEL_FAST',
  'PAYMENT_WHATSAPP',
  'PAYMENT_CONTACT_EMAIL',
  'PAYMENT_PHONE',
  'PAYMENT_PLANS',
  'PRICE_TND',
  'PRICE_PREMIUM_TND',
  'PRICE_BUSINESS_TND',
  'TRIAL_DAYS',
  'SECRETS_ENCRYPTION_KEY',
  'WA_PHONE_NUMBER_ID',
  'WA_BUSINESS_ACCOUNT_ID',
  'WA_ACCESS_TOKEN',
  'WA_APP_SECRET',
  'WA_VERIFY_TOKEN',
  'WA_GRAPH_VERSION',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_REVIEWS_WRITE_MODE',
  'GOOGLE_WALLET_ISSUER_ID',
  'GOOGLE_WALLET_SERVICE_ACCOUNT',
  'FLOUCI_ENV',
  'FLOUCI_PUBLIC_KEY',
  'FLOUCI_PRIVATE_KEY',
  'KONNECT_API_URL',
  'KONNECT_API_KEY',
  'KONNECT_WALLET_ID',
  'BACKUP_S3_ENDPOINT',
  'BACKUP_S3_BUCKET',
  'BACKUP_S3_ACCESS_KEY',
  'BACKUP_S3_SECRET_KEY',
]);

const fileArg = process.argv.indexOf('--file');
const { file, env } = loadEnv(
  fileArg > -1 ? process.argv[fileArg + 1] : undefined,
);

const lines: string[] = [];
let failed = false;
const fail = (text: string) => {
  failed = true;
  lines.push(`FAIL: ${text}`);
};

let appEnv: string;
try {
  appEnv = resolveAppEnv(env);
} catch (error) {
  fail((error as Error).message);
  appEnv = 'invalid';
}
console.log(`env:check  file=${file ?? '(none)'}  APP_ENV=${appEnv}`);

for (const problem of appEnv === 'invalid' ? [] : modeProblems(env)) {
  fail(problem);
}

const required =
  appEnv === 'development'
    ? ['DATABASE_URL', 'JWT_SECRET']
    : [...productionRequired];
for (const name of required) {
  if (!env[name]?.trim()) fail(`${name} missing`);
}
for (const name of ['JWT_SECRET', 'SCAN_HASH_SALT']) {
  const length = env[name]?.trim().length ?? 0;
  if (length > 0 && length < 32) fail(`${name} shorter than 32 characters`);
}

for (const name of namesIn(file)) {
  if (!KNOWN.has(name)) lines.push(`WARN: ${name} is not used by TableQR`);
}

for (const line of lines) console.log(line);
console.log(failed ? 'FAIL' : 'OK');
process.exit(failed ? 1 : 0);
