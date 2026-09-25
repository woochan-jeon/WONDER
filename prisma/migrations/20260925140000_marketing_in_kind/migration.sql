-- CreateEnum
CREATE TYPE "MarketingExpenseKind" AS ENUM ('CASH', 'IN_KIND');

-- AlterTable
ALTER TABLE "MarketingExpense" ADD COLUMN     "itemName" TEXT,
ADD COLUMN     "kind" "MarketingExpenseKind" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "unitCost" DOUBLE PRECISION;
