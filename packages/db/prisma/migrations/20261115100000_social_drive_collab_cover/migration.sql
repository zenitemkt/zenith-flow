-- Mídias das publicações no Drive, collab e capa de vídeo.
ALTER TABLE "content_version_media" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "social_post" ADD COLUMN "collaborators" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "social_post" ADD COLUMN "coverOffsetMs" INTEGER;
ALTER TABLE "social_post" ADD COLUMN "coverKey" TEXT;
CREATE TABLE "social_drive_folder" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "scheduledId" TEXT NOT NULL,
    "publishedId" TEXT NOT NULL,
    "failedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_drive_folder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_drive_folder_agencyId_key" ON "social_drive_folder"("agencyId");
