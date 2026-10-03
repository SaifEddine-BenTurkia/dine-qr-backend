// Runs before any test module is imported: ConfigModule.forRoot reads the
// environment at import time, so values set later in a test are never seen.
process.env.ADMIN_EMAILS =
  'e2e-admin@example.com,svc-admin@example.com,plans-admin@example.com';
// No real email or Google Wallet call from a test run, whatever the local
// sandbox file holds (an empty value in the environment wins over the file).
process.env.RESEND_API_KEY = '';
process.env.GOOGLE_WALLET_ISSUER_ID = '';
process.env.GOOGLE_WALLET_SERVICE_ACCOUNT = '';
