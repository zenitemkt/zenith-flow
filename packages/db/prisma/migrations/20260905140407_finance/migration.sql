-- CreateEnum
CREATE TYPE "FinanceEntryType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "FinanceEntryStatus" AS ENUM ('PREVISTO', 'PENDENTE', 'LIQUIDADO', 'VENCIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "finance_category" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceEntryType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_entry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" "FinanceEntryType" NOT NULL,
    "status" "FinanceEntryStatus" NOT NULL DEFAULT 'PREVISTO',
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "competencyDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "settledDate" TIMESTAMP(3),
    "reversalOfId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_entry_status_history" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "fromStatus" "FinanceEntryStatus",
    "toStatus" "FinanceEntryStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_entry_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_category_agencyId_idx" ON "finance_category"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_category_agencyId_name_type_key" ON "finance_category"("agencyId", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "finance_entry_reversalOfId_key" ON "finance_entry"("reversalOfId");

-- CreateIndex
CREATE INDEX "finance_entry_agencyId_idx" ON "finance_entry"("agencyId");

-- CreateIndex
CREATE INDEX "finance_entry_clientId_idx" ON "finance_entry"("clientId");

-- CreateIndex
CREATE INDEX "finance_entry_projectId_idx" ON "finance_entry"("projectId");

-- CreateIndex
CREATE INDEX "finance_entry_status_history_financeEntryId_idx" ON "finance_entry_status_history"("financeEntryId");

-- AddForeignKey
ALTER TABLE "finance_category" ADD CONSTRAINT "finance_category_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "finance_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry_status_history" ADD CONSTRAINT "finance_entry_status_history_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "finance_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

