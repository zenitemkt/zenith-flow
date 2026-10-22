-- CreateTable
CREATE TABLE "instagram_automation_rule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "keyword" TEXT,
    "responseText" TEXT NOT NULL,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "mediaId" TEXT,
    "mediaCaption" TEXT,
    "mediaPermalink" TEXT,
    "publicReplyTexts" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_automation_log" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ruleId" TEXT,
    "senderIgsid" TEXT NOT NULL,
    "storyId" TEXT,
    "commentId" TEXT,
    "messageId" TEXT,
    "receivedText" TEXT,
    "sentText" TEXT,
    "buttonUrl" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "readAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_automation_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_automation_rule_agencyId_idx" ON "instagram_automation_rule"("agencyId");

-- CreateIndex
CREATE INDEX "instagram_automation_rule_clientId_triggerType_active_idx" ON "instagram_automation_rule"("clientId", "triggerType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_automation_log_commentId_key" ON "instagram_automation_log"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_automation_log_messageId_key" ON "instagram_automation_log"("messageId");

-- CreateIndex
CREATE INDEX "instagram_automation_log_agencyId_clientId_createdAt_idx" ON "instagram_automation_log"("agencyId", "clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "instagram_automation_rule" ADD CONSTRAINT "instagram_automation_rule_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_automation_rule" ADD CONSTRAINT "instagram_automation_rule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_automation_log" ADD CONSTRAINT "instagram_automation_log_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_automation_log" ADD CONSTRAINT "instagram_automation_log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_automation_log" ADD CONSTRAINT "instagram_automation_log_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "instagram_automation_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
