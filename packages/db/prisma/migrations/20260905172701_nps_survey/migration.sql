-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "SurveyRecipientStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'RESPONDIDO');

-- AlterTable
ALTER TABLE "client_contact" ADD COLUMN     "marketingOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "survey_campaign" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "commentPrompt" TEXT,
    "headerText" TEXT,
    "footerText" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'RASCUNHO',
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_recipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "SurveyRecipientStatus" NOT NULL DEFAULT 'PENDENTE',
    "sentAt" TIMESTAMP(3),
    "score" INTEGER,
    "comment" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nps_snapshot" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "promoters" INTEGER NOT NULL,
    "passives" INTEGER NOT NULL,
    "detractors" INTEGER NOT NULL,
    "totalResponses" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nps_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_campaign_agencyId_idx" ON "survey_campaign"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_recipient_token_key" ON "survey_recipient"("token");

-- CreateIndex
CREATE INDEX "survey_recipient_campaignId_idx" ON "survey_recipient"("campaignId");

-- CreateIndex
CREATE INDEX "survey_recipient_clientId_idx" ON "survey_recipient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_recipient_campaignId_clientId_key" ON "survey_recipient"("campaignId", "clientId");

-- CreateIndex
CREATE INDEX "nps_snapshot_agencyId_idx" ON "nps_snapshot"("agencyId");

-- CreateIndex
CREATE INDEX "nps_snapshot_campaignId_idx" ON "nps_snapshot"("campaignId");

-- AddForeignKey
ALTER TABLE "survey_campaign" ADD CONSTRAINT "survey_campaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_recipient" ADD CONSTRAINT "survey_recipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "survey_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_recipient" ADD CONSTRAINT "survey_recipient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nps_snapshot" ADD CONSTRAINT "nps_snapshot_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nps_snapshot" ADD CONSTRAINT "nps_snapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "survey_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

