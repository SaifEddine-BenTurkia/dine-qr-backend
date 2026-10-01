-- CreateEnum
CREATE TYPE "PaymentContactMethod" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'CANCELED');

-- DropIndex
DROP INDEX "Subscription_paddleSubscriptionId_key";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "cancelAtPeriodEnd",
DROP COLUMN "paddleCustomerId",
DROP COLUMN "paddleSubscriptionId",
DROP COLUMN "paddleUpdatedAt",
ALTER COLUMN "currency" SET DEFAULT 'TND';

-- DropTable
DROP TABLE "ProcessedWebhookEvent";

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TND',
    "contactMethod" "PaymentContactMethod" NOT NULL,
    "note" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "amountReceived" DECIMAL(10,3),
    "adminNote" TEXT,
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_reference_key" ON "PaymentRequest"("reference");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_createdAt_idx" ON "PaymentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_userId_createdAt_idx" ON "PaymentRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

