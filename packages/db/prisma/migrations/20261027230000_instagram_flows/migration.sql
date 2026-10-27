-- Sequências do mini-chat de Instagram: passos na regra, contatos e sessões.
ALTER TABLE "instagram_automation_rule" ADD COLUMN "flow" JSONB;

CREATE TABLE "instagram_contact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "igsid" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "tags" TEXT[],
    "fields" JSONB NOT NULL DEFAULT '{}',
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "instagram_contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "instagram_flow_session" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStepId" TEXT,
    "resumeAt" TIMESTAMP(3),
    "needsUserReply" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "instagram_flow_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instagram_contact_clientId_igsid_key" ON "instagram_contact"("clientId", "igsid");
CREATE INDEX "instagram_contact_agencyId_clientId_updatedAt_idx" ON "instagram_contact"("agencyId", "clientId", "updatedAt");
CREATE INDEX "instagram_flow_session_status_resumeAt_idx" ON "instagram_flow_session"("status", "resumeAt");
CREATE INDEX "instagram_flow_session_contactId_status_idx" ON "instagram_flow_session"("contactId", "status");

ALTER TABLE "instagram_contact" ADD CONSTRAINT "instagram_contact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_contact" ADD CONSTRAINT "instagram_contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_flow_session" ADD CONSTRAINT "instagram_flow_session_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_flow_session" ADD CONSTRAINT "instagram_flow_session_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_flow_session" ADD CONSTRAINT "instagram_flow_session_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "instagram_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_flow_session" ADD CONSTRAINT "instagram_flow_session_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "instagram_automation_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
