CREATE TABLE "competitor" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "igUsername" TEXT NOT NULL,
    "isOwn" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "displayName" TEXT,
    "biography" TEXT,
    "website" TEXT,
    "pictureUrl" TEXT,
    "followers" INTEGER,
    "follows" INTEGER,
    "mediaCount" INTEGER,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "aiReport" TEXT,
    "aiReportAt" TIMESTAMP(3),
    "aiReportDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competitor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "competitor_clientId_igUsername_key" ON "competitor"("clientId", "igUsername");
CREATE INDEX "competitor_agencyId_idx" ON "competitor"("agencyId");
ALTER TABLE "competitor" ADD CONSTRAINT "competitor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "competitor_post" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "igMediaId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" TEXT NOT NULL,
    "mediaProductType" TEXT,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "permalink" TEXT,
    "likeCount" INTEGER,
    "commentsCount" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "competitor_post_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "competitor_post_igMediaId_key" ON "competitor_post"("igMediaId");
CREATE INDEX "competitor_post_competitorId_timestamp_idx" ON "competitor_post"("competitorId", "timestamp");
ALTER TABLE "competitor_post" ADD CONSTRAINT "competitor_post_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "competitor_snapshot" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "followers" INTEGER,
    "follows" INTEGER,
    "mediaCount" INTEGER,
    CONSTRAINT "competitor_snapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "competitor_snapshot_competitorId_day_key" ON "competitor_snapshot"("competitorId", "day");
ALTER TABLE "competitor_snapshot" ADD CONSTRAINT "competitor_snapshot_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
