-- Token da extensão: apenas o hash é persistido; o segredo aparece uma vez ao gerar.
ALTER TABLE "Agency"
  ADD COLUMN "competitorAdsTokenHash" TEXT,
  ADD COLUMN "competitorAdsTokenCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Agency_competitorAdsTokenHash_key" ON "Agency"("competitorAdsTokenHash");

CREATE TABLE "competitor_ad" (
  "id" TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "adArchiveId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "bodyText" TEXT,
  "headline" TEXT,
  "linkUrl" TEXT,
  "ctaLabel" TEXT,
  "creativeUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "format" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "competitor_ad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competitor_ad_competitorId_adArchiveId_key" ON "competitor_ad"("competitorId", "adArchiveId");
CREATE INDEX "competitor_ad_competitorId_active_lastSeenAt_idx" ON "competitor_ad"("competitorId", "active", "lastSeenAt");

ALTER TABLE "competitor_ad"
  ADD CONSTRAINT "competitor_ad_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
