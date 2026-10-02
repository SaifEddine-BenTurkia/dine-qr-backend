-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "aiLocales" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Dish" ADD COLUMN     "aiLocales" TEXT[] DEFAULT ARRAY[]::TEXT[];

