CREATE TYPE "AdCreativeStatus" AS ENUM ('DRAFT', 'UPLOADING', 'IN_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED', 'FAILED');
CREATE TYPE "AdCreativeKind" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "ad_creative_folder" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootFolderId" TEXT NOT NULL,
    "inboxFolderId" TEXT NOT NULL,
    "liveFolderId" TEXT NOT NULL,
    "pausedFolderId" TEXT NOT NULL,
    "failedFolderId" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_creative_folder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ad_creative_folder_agencyId_rootFolderId_key" ON "ad_creative_folder"("agencyId", "rootFolderId");
ALTER TABLE "ad_creative_folder" ADD CONSTRAINT "ad_creative_folder_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad_creative" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "AdCreativeKind" NOT NULL,
    "sizeBytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "AdCreativeStatus" NOT NULL DEFAULT 'DRAFT',
    "missingInDrive" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "primaryText" TEXT,
    "headline" TEXT,
    "description" TEXT,
    "linkUrl" TEXT,
    "callToAction" TEXT,
    "metaImageHash" TEXT,
    "metaVideoId" TEXT,
    "metaCreativeId" TEXT,
    "metaAdId" TEXT,
    "lastError" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_creative_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ad_creative_driveFileId_key" ON "ad_creative"("driveFileId");
CREATE INDEX "ad_creative_agencyId_status_idx" ON "ad_creative"("agencyId", "status");
CREATE INDEX "ad_creative_folderId_idx" ON "ad_creative"("folderId");
ALTER TABLE "ad_creative" ADD CONSTRAINT "ad_creative_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_creative" ADD CONSTRAINT "ad_creative_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ad_creative_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
