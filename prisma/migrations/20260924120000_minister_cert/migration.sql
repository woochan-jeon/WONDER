-- CreateEnum
CREATE TYPE "CertExhibitionLocation" AS ENUM ('DOMESTIC', 'OVERSEAS');

-- CreateTable
CREATE TABLE "CertMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gpaOk" BOOLEAN NOT NULL DEFAULT false,
    "gpaCheckedAt" TIMESTAMP(3),
    "reportSubmitted" BOOLEAN NOT NULL DEFAULT true,
    "certGukmusa1" BOOLEAN NOT NULL DEFAULT false,
    "certTradeEnglish1" BOOLEAN NOT NULL DEFAULT false,
    "certLogistics" BOOLEAN NOT NULL DEFAULT false,
    "certDistribution1" BOOLEAN NOT NULL DEFAULT false,
    "certDistribution2" BOOLEAN NOT NULL DEFAULT false,
    "certImportManager" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CertMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertLangScore" (
    "id" TEXT NOT NULL,
    "exam" TEXT NOT NULL,
    "grade" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "CertLangScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertExhibition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" "CertExhibitionLocation" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "CertExhibition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CertMember_name_key" ON "CertMember"("name");

-- CreateIndex
CREATE INDEX "CertLangScore_memberId_idx" ON "CertLangScore"("memberId");

-- CreateIndex
CREATE INDEX "CertExhibition_memberId_idx" ON "CertExhibition"("memberId");

-- AddForeignKey
ALTER TABLE "CertLangScore" ADD CONSTRAINT "CertLangScore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CertMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertExhibition" ADD CONSTRAINT "CertExhibition_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CertMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
