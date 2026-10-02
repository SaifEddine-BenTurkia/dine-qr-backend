-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('WAITER', 'BILL_CASH', 'BILL_CARD');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "nameI18n" JSONB;

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "descriptionI18n" JSONB,
ADD COLUMN     "nameI18n" JSONB,
ADD COLUMN     "soldOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "soldOutUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "contactConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tableLabel" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "defaultLocale" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN     "enabledLocales" TEXT[] DEFAULT ARRAY['fr']::TEXT[],
ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "wifiPassword" TEXT,
ADD COLUMN     "wifiSsid" TEXT;

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "zone" TEXT,
    "token" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "ServiceRequestType" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tableId" TEXT,
    "sessionId" TEXT,
    "itemId" TEXT,
    "props" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_token_key" ON "DiningTable"("token");

-- CreateIndex
CREATE INDEX "DiningTable_restaurantId_position_idx" ON "DiningTable"("restaurantId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_restaurantId_label_key" ON "DiningTable"("restaurantId", "label");

-- CreateIndex
CREATE INDEX "ServiceRequest_restaurantId_status_createdAt_idx" ON "ServiceRequest"("restaurantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_tableId_type_createdAt_idx" ON "ServiceRequest"("tableId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_restaurantId_type_occurredAt_idx" ON "Event"("restaurantId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_restaurantId_occurredAt_idx" ON "Event"("restaurantId", "occurredAt");

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

