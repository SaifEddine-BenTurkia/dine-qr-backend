-- CreateEnum
CREATE TYPE "LoyaltyEventType" AS ENUM ('STAMP', 'REDEEM');

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "loyaltyCardId" TEXT;

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "restaurantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "stampsRequired" INTEGER NOT NULL DEFAULT 9,
    "rewardText" TEXT NOT NULL DEFAULT '1 consommation offerte',
    "minSpendMillimes" INTEGER NOT NULL DEFAULT 0,
    "cardTitle" TEXT,
    "backgroundColor" TEXT NOT NULL DEFAULT '#7c2d12',
    "stampIcon" TEXT NOT NULL DEFAULT 'coffee',
    "terms" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("restaurantId")
);

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "totalStamps" INTEGER NOT NULL DEFAULT 0,
    "rewardsRedeemed" INTEGER NOT NULL DEFAULT 0,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastStampAt" TIMESTAMP(3),

    CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyEvent" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "LoyaltyEventType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "billId" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_code_key" ON "LoyaltyCard"("code");

-- CreateIndex
CREATE INDEX "LoyaltyCard_restaurantId_createdAt_idx" ON "LoyaltyCard"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_restaurantId_phone_key" ON "LoyaltyCard"("restaurantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEvent_billId_key" ON "LoyaltyEvent"("billId");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_restaurantId_createdAt_idx" ON "LoyaltyEvent"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_cardId_createdAt_idx" ON "LoyaltyEvent"("cardId", "createdAt");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_loyaltyCardId_fkey" FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEvent" ADD CONSTRAINT "LoyaltyEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
