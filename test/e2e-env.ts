// Runs before any test module is imported: ConfigModule.forRoot reads the
// environment at import time, so values set later in a test are never seen.
process.env.PADDLE_WEBHOOK_SECRET = 'e2e-webhook-secret';
