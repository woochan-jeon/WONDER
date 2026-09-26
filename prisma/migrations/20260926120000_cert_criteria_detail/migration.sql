-- AlterTable
ALTER TABLE "CertMember" ADD COLUMN     "certBondedAgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "certCustomsBroker1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "certForexManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "certFtaOrigin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gtepCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gtepCompletedAt" TIMESTAMP(3),
ADD COLUMN     "teamEcomReport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamEcomSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamExportAmount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "teamExportContract" BOOLEAN NOT NULL DEFAULT false;
