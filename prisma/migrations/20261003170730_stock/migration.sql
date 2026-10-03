-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RESTOCK', 'SALE', 'RETURN', 'WASTE', 'ADJUST');

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "promoEndsAt" TIMESTAMP(3),
ADD COLUMN     "promoPriceMillimes" INTEGER,
ADD COLUMN     "stockQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "actor" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockBatch_dishId_expiresAt_idx" ON "StockBatch"("dishId", "expiresAt");

-- CreateIndex
CREATE INDEX "StockBatch_restaurantId_expiresAt_idx" ON "StockBatch"("restaurantId", "expiresAt");

-- CreateIndex
CREATE INDEX "StockMovement_restaurantId_createdAt_idx" ON "StockMovement"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_dishId_createdAt_idx" ON "StockMovement"("dishId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- AddForeignKey
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
