-- CreateEnum
CREATE TYPE "UiStyle" AS ENUM ('ZENITE', 'MINIMALISTA');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "uiStyle" "UiStyle" NOT NULL DEFAULT 'ZENITE';

-- CreateTable
CREATE TABLE "client_segment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_segment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "client" ADD COLUMN "segmentId" TEXT,
ADD COLUMN "avatarKey" TEXT,
ADD COLUMN "bannerKey" TEXT,
ADD COLUMN "socialLinks" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "client_segment_agencyId_name_key" ON "client_segment"("agencyId", "name");

-- AddForeignKey
ALTER TABLE "client_segment" ADD CONSTRAINT "client_segment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "client_segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
