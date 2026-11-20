-- CreateEnum
CREATE TYPE "ProspectTemperature" AS ENUM ('QUENTE', 'MORNO', 'FRIO');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOVO', 'CONTATADO', 'RESPONDEU', 'DESQUALIFICADO', 'VIROU_LEAD');

-- CreateTable
CREATE TABLE "prospecting_settings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "apifyTokenEnc" TEXT,
    "config" JSONB NOT NULL,
    "pendingRuns" JSONB,
    "lastSearchAt" TIMESTAMP(3),
    "lastSearchError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospecting_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "segment" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "category" TEXT,
    "mapsUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "temperature" "ProspectTemperature" NOT NULL DEFAULT 'FRIO',
    "potential" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOVO',
    "sequenceDay" INTEGER NOT NULL DEFAULT 0,
    "optOut" BOOLEAN NOT NULL DEFAULT false,
    "lastContactedAt" TIMESTAMP(3),
    "nextContactAt" TIMESTAMP(3),
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_contact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,

    CONSTRAINT "prospect_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_send_log" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "prospect_send_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospecting_settings_agencyId_key" ON "prospecting_settings"("agencyId");

-- CreateIndex
CREATE INDEX "prospect_agencyId_status_idx" ON "prospect"("agencyId", "status");

-- CreateIndex
CREATE INDEX "prospect_agencyId_score_idx" ON "prospect"("agencyId", "score");

-- CreateIndex
CREATE INDEX "prospect_contact_prospectId_idx" ON "prospect_contact"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_contact_agencyId_normalizedValue_key" ON "prospect_contact"("agencyId", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "prospect_send_log_agencyId_channel_day_key" ON "prospect_send_log"("agencyId", "channel", "day");

-- AddForeignKey
ALTER TABLE "prospecting_settings" ADD CONSTRAINT "prospecting_settings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect" ADD CONSTRAINT "prospect_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_contact" ADD CONSTRAINT "prospect_contact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

