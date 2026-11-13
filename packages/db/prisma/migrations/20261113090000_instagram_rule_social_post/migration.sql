ALTER TABLE "instagram_automation_rule" ADD COLUMN "socialPostId" TEXT;
CREATE INDEX "instagram_automation_rule_socialPostId_idx" ON "instagram_automation_rule"("socialPostId");
