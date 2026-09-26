-- AlterTable
ALTER TABLE "CertMember" ADD COLUMN     "gpaSemesterCheckedAt" TIMESTAMP(3),
ADD COLUMN     "gpaSemesterOk" BOOLEAN NOT NULL DEFAULT false;
