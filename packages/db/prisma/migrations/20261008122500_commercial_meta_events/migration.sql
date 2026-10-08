CREATE TABLE "commercial_meta_event" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "leadId" TEXT,
  "clientId" TEXT,
  "valueCents" INTEGER,
  "status" "EventDeliveryStatus" NOT NULL,
  "error" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_meta_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commercial_meta_event_agencyId_eventKey_key" ON "commercial_meta_event"("agencyId", "eventKey");
CREATE INDEX "commercial_meta_event_agencyId_attemptedAt_idx" ON "commercial_meta_event"("agencyId", "attemptedAt");
ALTER TABLE "commercial_meta_event" ADD CONSTRAINT "commercial_meta_event_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
