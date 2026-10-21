-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'GOOGLE_BUSINESS');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SocialPostFormat" AS ENUM ('FEED', 'REEL', 'STORY');

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "autoScheduleOnApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultPublishTime" TEXT NOT NULL DEFAULT '10:00';

-- CreateTable
CREATE TABLE "content_version_media" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_version_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_connection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "pictureUrl" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contentItemId" TEXT,
    "versionId" TEXT,
    "connectionId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "format" "SocialPostFormat" NOT NULL DEFAULT 'FEED',
    "caption" TEXT,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "externalContainerId" TEXT,
    "externalPostId" TEXT,
    "permalink" TEXT,
    "lastError" TEXT,
    "publishedAt" TIMESTAMP(3),
    "autoScheduled" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_version_media_key_key" ON "content_version_media"("key");

-- CreateIndex
CREATE INDEX "content_version_media_versionId_idx" ON "content_version_media"("versionId");

-- CreateIndex
CREATE INDEX "social_connection_agencyId_idx" ON "social_connection"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "social_connection_clientId_platform_key" ON "social_connection"("clientId", "platform");

-- CreateIndex
CREATE INDEX "social_post_status_publishAt_idx" ON "social_post"("status", "publishAt");

-- CreateIndex
CREATE INDEX "social_post_agencyId_publishAt_idx" ON "social_post"("agencyId", "publishAt");

-- CreateIndex
CREATE INDEX "social_post_contentItemId_idx" ON "social_post"("contentItemId");

-- AddForeignKey
ALTER TABLE "content_version_media" ADD CONSTRAINT "content_version_media_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "content_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connection" ADD CONSTRAINT "social_connection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_connection" ADD CONSTRAINT "social_connection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "content_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "social_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

