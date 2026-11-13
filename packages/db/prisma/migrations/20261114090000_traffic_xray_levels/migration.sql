-- Raio X fase 2A: sincronização em três níveis, métricas por conjunto/anúncio e mapa automático.
ALTER TABLE "ad_set" ADD COLUMN "metaStatus" TEXT;
ALTER TABLE "ad" ADD COLUMN "metaStatus" TEXT;
ALTER TABLE "ad" ADD COLUMN "reviewFeedback" TEXT;
ALTER TABLE "ad" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "campaign_geo_target" ADD COLUMN "externalKey" TEXT;
ALTER TABLE "ad_account_connection" ADD COLUMN "metaFullSyncAt" TIMESTAMP(3);

CREATE TABLE "ad_set_daily_metric" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_set_daily_metric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ad_set_daily_metric_adSetId_date_key" ON "ad_set_daily_metric"("adSetId", "date");
ALTER TABLE "ad_set_daily_metric" ADD CONSTRAINT "ad_set_daily_metric_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ad_daily_metric" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_daily_metric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ad_daily_metric_adId_date_key" ON "ad_daily_metric"("adId", "date");
ALTER TABLE "ad_daily_metric" ADD CONSTRAINT "ad_daily_metric_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
