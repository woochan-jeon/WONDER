-- AlterTable
ALTER TABLE "MarketingProject" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KRW';

-- AlterTable
ALTER TABLE "MarketingBudget" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MarketingExpense" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "MarketingExchangeRate" (
    "currency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingExchangeRate_pkey" PRIMARY KEY ("currency")
);
