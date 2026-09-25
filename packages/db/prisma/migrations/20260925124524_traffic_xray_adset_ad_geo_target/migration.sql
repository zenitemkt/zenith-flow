-- AlterTable
ALTER TABLE "campaign_daily_metric" ADD COLUMN     "resultValueCents" INTEGER;

-- CreateTable
CREATE TABLE "ad_set" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budgetCents" INTEGER,
    "targetingSummary" TEXT,
    "externalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creativeNote" TEXT,
    "assetUrl" TEXT,
    "externalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_geo_target" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_geo_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_set_campaignId_idx" ON "ad_set"("campaignId");

-- CreateIndex
CREATE INDEX "ad_adSetId_idx" ON "ad"("adSetId");

-- CreateIndex
CREATE INDEX "campaign_geo_target_campaignId_idx" ON "campaign_geo_target"("campaignId");

-- AddForeignKey
ALTER TABLE "ad_set" ADD CONSTRAINT "ad_set_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad" ADD CONSTRAINT "ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_geo_target" ADD CONSTRAINT "campaign_geo_target_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
