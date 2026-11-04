-- Lead Ads da Meta: formulário nativo entra no CRM.
ALTER TABLE "social_connection" ADD COLUMN "leadsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "social_connection" ADD COLUMN "leadsSubscribedAt" TIMESTAMP(3);
ALTER TABLE "social_connection" ADD COLUMN "leadsLastError" TEXT;

CREATE TABLE "meta_lead_event" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "formId" TEXT,
    "formName" TEXT,
    "adId" TEXT,
    "campaignName" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "leadId" TEXT,
    "submissionId" TEXT,
    "origin" TEXT NOT NULL,
    "leadCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meta_lead_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_lead_event_leadgenId_key" ON "meta_lead_event"("leadgenId");
CREATE INDEX "meta_lead_event_agencyId_createdAt_idx" ON "meta_lead_event"("agencyId", "createdAt");
CREATE INDEX "meta_lead_event_connectionId_status_idx" ON "meta_lead_event"("connectionId", "status");

ALTER TABLE "meta_lead_event" ADD CONSTRAINT "meta_lead_event_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_lead_event" ADD CONSTRAINT "meta_lead_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "social_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
