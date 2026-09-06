-- CreateEnum
CREATE TYPE "TrackingConsentCategory" AS ENUM ('ESSENCIAL', 'ANALYTICS', 'MARKETING', 'PERSONALIZACAO');

-- AlterTable
ALTER TABLE "agency" ADD COLUMN     "trackingWriteKey" TEXT;

-- CreateTable
CREATE TABLE "tracking_visitor" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "leadId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_session" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "landingUrl" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,

    CONSTRAINT "tracking_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_event" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "eventName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "properties" JSONB,
    "consent" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_consent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "categories" "TrackingConsentCategory"[],
    "noticeVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_consent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracking_visitor_agencyId_idx" ON "tracking_visitor"("agencyId");

-- CreateIndex
CREATE INDEX "tracking_visitor_leadId_idx" ON "tracking_visitor"("leadId");

-- CreateIndex
CREATE INDEX "tracking_session_visitorId_idx" ON "tracking_session"("visitorId");

-- CreateIndex
CREATE INDEX "tracking_event_agencyId_occurredAt_idx" ON "tracking_event"("agencyId", "occurredAt");

-- CreateIndex
CREATE INDEX "tracking_event_visitorId_idx" ON "tracking_event"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_event_agencyId_eventId_key" ON "tracking_event"("agencyId", "eventId");

-- CreateIndex
CREATE INDEX "tracking_consent_visitorId_idx" ON "tracking_consent"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "agency_trackingWriteKey_key" ON "agency"("trackingWriteKey");

-- AddForeignKey
ALTER TABLE "tracking_visitor" ADD CONSTRAINT "tracking_visitor_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_visitor" ADD CONSTRAINT "tracking_visitor_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_session" ADD CONSTRAINT "tracking_session_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "tracking_visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_event" ADD CONSTRAINT "tracking_event_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_event" ADD CONSTRAINT "tracking_event_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "tracking_visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_event" ADD CONSTRAINT "tracking_event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tracking_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_consent" ADD CONSTRAINT "tracking_consent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_consent" ADD CONSTRAINT "tracking_consent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "tracking_visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

