-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ATIVA', 'PAUSADA', 'ENCERRADA');

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "objective" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budgetCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "ownerUserId" TEXT,
    "externalId" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_daily_metric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "results" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_daily_metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_agencyId_idx" ON "campaign"("agencyId");

-- CreateIndex
CREATE INDEX "campaign_daily_metric_campaignId_idx" ON "campaign_daily_metric"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_daily_metric_campaignId_date_key" ON "campaign_daily_metric"("campaignId", "date");

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_daily_metric" ADD CONSTRAINT "campaign_daily_metric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

