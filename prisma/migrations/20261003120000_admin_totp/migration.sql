-- Admin console second factor (ADM-02).
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "lastTotpStep" INTEGER;
