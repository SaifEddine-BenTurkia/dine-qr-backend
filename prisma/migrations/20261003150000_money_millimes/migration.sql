-- P0-04: money as integer millimes. Exact conversion: Decimal(10,3) * 1000 has
-- no fractional part, so ROUND only changes the type.
ALTER TABLE "Dish" ADD COLUMN "priceMillimes" INTEGER;
UPDATE "Dish" SET "priceMillimes" = ROUND("price" * 1000)::INTEGER;
ALTER TABLE "Dish" ALTER COLUMN "priceMillimes" SET NOT NULL;
ALTER TABLE "Dish" DROP COLUMN "price";

ALTER TABLE "PaymentRequest" ADD COLUMN "amountMillimes" INTEGER,
ADD COLUMN "amountReceivedMillimes" INTEGER;
UPDATE "PaymentRequest" SET "amountMillimes" = ROUND("amount" * 1000)::INTEGER,
  "amountReceivedMillimes" = ROUND("amountReceived" * 1000)::INTEGER;
ALTER TABLE "PaymentRequest" ALTER COLUMN "amountMillimes" SET NOT NULL;
ALTER TABLE "PaymentRequest" DROP COLUMN "amount",
DROP COLUMN "amountReceived";
