-- AlterTable
ALTER TABLE "client" ADD COLUMN     "competitorName" TEXT,
ADD COLUMN     "reactivationEligible" BOOLEAN NOT NULL DEFAULT true;

