CREATE TABLE "traffic_settings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "dailyBudgetCapCents" INTEGER,
    "cplGoodCents" INTEGER,
    "cplMaxCents" INTEGER,
    "maxBudgetChangePct" INTEGER NOT NULL DEFAULT 20,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "pageConnectionId" TEXT,
    "privacyPolicyUrl" TEXT,
    "websiteUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "traffic_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "traffic_settings_agencyId_key" ON "traffic_settings"("agencyId");
ALTER TABLE "traffic_settings" ADD CONSTRAINT "traffic_settings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "TrafficCampaignStatus" AS ENUM ('DRAFT', 'SUBMITTING', 'SUBMITTED', 'FAILED');
CREATE TABLE "traffic_campaign" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TrafficCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "plan" JSONB NOT NULL,
    "progress" JSONB,
    "metaCampaignId" TEXT,
    "lastError" TEXT,
    "createdByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "traffic_campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "traffic_campaign_agencyId_createdAt_idx" ON "traffic_campaign"("agencyId", "createdAt");
ALTER TABLE "traffic_campaign" ADD CONSTRAINT "traffic_campaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
