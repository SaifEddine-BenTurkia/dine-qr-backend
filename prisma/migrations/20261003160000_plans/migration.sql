-- P0-03: three plans (standard, premium, business).
ALTER TABLE "Subscription" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "PaymentRequest" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'standard';
