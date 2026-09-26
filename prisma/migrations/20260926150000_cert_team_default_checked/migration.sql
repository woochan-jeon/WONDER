-- AlterTable
ALTER TABLE "CertMember" ALTER COLUMN "teamEcomReport" SET DEFAULT true,
ALTER COLUMN "teamEcomSale" SET DEFAULT true,
ALTER COLUMN "teamExportAmount" SET DEFAULT true,
ALTER COLUMN "teamExportContract" SET DEFAULT true;

-- Existing people get the new default too (these columns were only added
-- earlier today, so nothing has been deliberately unchecked yet).
UPDATE "CertMember" SET "teamExportContract" = true, "teamExportAmount" = true, "teamEcomSale" = true, "teamEcomReport" = true;
