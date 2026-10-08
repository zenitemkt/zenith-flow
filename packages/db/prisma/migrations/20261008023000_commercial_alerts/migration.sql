CREATE TYPE "CommercialAlertStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
CREATE TYPE "CommercialAlertType" AS ENUM ('HOT_LEAD', 'RETURNING_LEAD', 'FORM_ABANDONED', 'CLIENT_RETURNED', 'RETURNED_AFTER_PROPOSAL');

CREATE TABLE "commercial_alert" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" "CommercialAlertType" NOT NULL,
    "status" "CommercialAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "score" INTEGER,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "ignoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "commercial_alert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commercial_alert_agencyId_eventKey_key" ON "commercial_alert"("agencyId", "eventKey");
CREATE INDEX "commercial_alert_agencyId_status_detectedAt_idx" ON "commercial_alert"("agencyId", "status", "detectedAt");
CREATE INDEX "commercial_alert_leadId_idx" ON "commercial_alert"("leadId");

ALTER TABLE "commercial_alert" ADD CONSTRAINT "commercial_alert_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_alert" ADD CONSTRAINT "commercial_alert_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
