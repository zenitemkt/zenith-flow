ALTER TABLE "competitor"
  ADD COLUMN "googlePlaceId" TEXT,
  ADD COLUMN "googlePlaceName" TEXT,
  ADD COLUMN "googlePlaceAddress" TEXT,
  ADD COLUMN "googleRating" DOUBLE PRECISION,
  ADD COLUMN "googleReviewCount" INTEGER,
  ADD COLUMN "googleLastSyncAt" TIMESTAMP(3),
  ADD COLUMN "googleLastError" TEXT;

CREATE TABLE "competitor_google_snapshot" (
  "id" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "rating" DOUBLE PRECISION,
  "reviewCount" INTEGER,
  CONSTRAINT "competitor_google_snapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competitor_google_snapshot_competitorId_day_key"
  ON "competitor_google_snapshot"("competitorId", "day");
CREATE INDEX "competitor_google_snapshot_competitorId_day_idx"
  ON "competitor_google_snapshot"("competitorId", "day");
ALTER TABLE "competitor_google_snapshot"
  ADD CONSTRAINT "competitor_google_snapshot_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
