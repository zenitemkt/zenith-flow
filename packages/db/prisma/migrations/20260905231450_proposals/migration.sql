-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'ACEITA', 'REJEITADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "proposal" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "content" TEXT NOT NULL,
    "valueCents" INTEGER,
    "status" "ProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_status_history" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "fromStatus" "ProposalStatus",
    "toStatus" "ProposalStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposal_token_key" ON "proposal"("token");

-- CreateIndex
CREATE INDEX "proposal_agencyId_idx" ON "proposal"("agencyId");

-- CreateIndex
CREATE INDEX "proposal_clientId_idx" ON "proposal"("clientId");

-- CreateIndex
CREATE INDEX "proposal_leadId_idx" ON "proposal"("leadId");

-- CreateIndex
CREATE INDEX "proposal_opportunityId_idx" ON "proposal"("opportunityId");

-- CreateIndex
CREATE INDEX "proposal_status_history_proposalId_idx" ON "proposal_status_history"("proposalId");

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_status_history" ADD CONSTRAINT "proposal_status_history_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

