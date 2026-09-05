-- CreateEnum
CREATE TYPE "EnpsCampaignStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "EnpsInviteStatus" AS ENUM ('PENDENTE', 'ENVIADO', 'RESPONDIDO');

-- CreateTable
CREATE TABLE "enps_campaign" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "commentPrompt" TEXT,
    "headerText" TEXT,
    "footerText" TEXT,
    "status" "EnpsCampaignStatus" NOT NULL DEFAULT 'RASCUNHO',
    "sentAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enps_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enps_invite" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "EnpsInviteStatus" NOT NULL DEFAULT 'PENDENTE',
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enps_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enps_response" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enps_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enps_snapshot" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "promoters" INTEGER NOT NULL,
    "passives" INTEGER NOT NULL,
    "detractors" INTEGER NOT NULL,
    "totalResponses" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enps_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enps_campaign_agencyId_idx" ON "enps_campaign"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "enps_invite_token_key" ON "enps_invite"("token");

-- CreateIndex
CREATE INDEX "enps_invite_campaignId_idx" ON "enps_invite"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "enps_invite_campaignId_employeeId_key" ON "enps_invite"("campaignId", "employeeId");

-- CreateIndex
CREATE INDEX "enps_response_campaignId_idx" ON "enps_response"("campaignId");

-- CreateIndex
CREATE INDEX "enps_snapshot_agencyId_idx" ON "enps_snapshot"("agencyId");

-- CreateIndex
CREATE INDEX "enps_snapshot_campaignId_idx" ON "enps_snapshot"("campaignId");

-- AddForeignKey
ALTER TABLE "enps_campaign" ADD CONSTRAINT "enps_campaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enps_invite" ADD CONSTRAINT "enps_invite_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "enps_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enps_invite" ADD CONSTRAINT "enps_invite_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enps_response" ADD CONSTRAINT "enps_response_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "enps_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enps_snapshot" ADD CONSTRAINT "enps_snapshot_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enps_snapshot" ADD CONSTRAINT "enps_snapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "enps_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

