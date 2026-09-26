ALTER TABLE "finance_entry"
  ADD COLUMN "opportunityId" TEXT,
  ADD COLUMN "proposalId" TEXT;

CREATE INDEX "finance_entry_opportunityId_idx" ON "finance_entry"("opportunityId");
CREATE INDEX "finance_entry_proposalId_idx" ON "finance_entry"("proposalId");

ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Accepted historical proposals receive a pending receivable. Settlement is
-- never inferred retroactively and still requires an explicit finance action.
INSERT INTO "finance_entry" (
  "id", "agencyId", "type", "status", "description", "amountCents",
  "clientId", "opportunityId", "proposalId", "competencyDate", "dueDate",
  "createdByUserId", "createdAt", "updatedAt"
)
SELECT
  'fe_' || substr(md5(random()::text || proposal."id"), 1, 22),
  proposal."agencyId", 'RECEITA', 'PENDENTE',
  'Proposta aceita: ' || proposal."name", proposal."valueCents",
  proposal."clientId", proposal."opportunityId", proposal."id",
  COALESCE(proposal."respondedAt", proposal."updatedAt"),
  COALESCE(proposal."respondedAt", proposal."updatedAt"),
  proposal."createdByUserId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "proposal"
WHERE proposal."status" = 'ACEITA'
  AND proposal."valueCents" IS NOT NULL AND proposal."valueCents" > 0
  AND NOT EXISTS (SELECT 1 FROM "finance_entry" existing WHERE existing."proposalId" = proposal."id");

INSERT INTO "finance_entry_status_history" (
  "id", "financeEntryId", "toStatus", "reason", "createdAt"
)
SELECT
  'fesh_' || substr(md5(random()::text || entry."id"), 1, 20),
  entry."id", 'PENDENTE', 'Recebível criado a partir de proposta aceita', CURRENT_TIMESTAMP
FROM "finance_entry" entry
WHERE entry."proposalId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "finance_entry_status_history" history WHERE history."financeEntryId" = entry."id"
  );
