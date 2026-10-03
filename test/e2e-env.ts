// Runs before any test module is imported: ConfigModule.forRoot reads the
// environment at import time, so values set later in a test are never seen.
process.env.ADMIN_EMAILS =
  'e2e-admin@example.com,svc-admin@example.com,plans-admin@example.com';
