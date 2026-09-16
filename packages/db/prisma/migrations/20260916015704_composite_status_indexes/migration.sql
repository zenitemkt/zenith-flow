-- CreateIndex
CREATE INDEX "content_item_agencyId_status_idx" ON "content_item"("agencyId", "status");

-- CreateIndex
CREATE INDEX "finance_entry_agencyId_status_dueDate_idx" ON "finance_entry"("agencyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "opportunity_agencyId_status_idx" ON "opportunity"("agencyId", "status");
