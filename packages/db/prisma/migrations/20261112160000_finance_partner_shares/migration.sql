-- Divisão do financeiro entre sócios: lista de sócios, parte de cada um por lançamento e padrão por cliente.
-- Só cria tabelas novas; nenhuma tabela existente é alterada.

-- CreateTable
CREATE TABLE "finance_partner" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_entry_share" (
    "id" TEXT NOT NULL,
    "financeEntryId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_entry_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_partner_share" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_partner_share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_partner_agencyId_idx" ON "finance_partner"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_partner_agencyId_name_key" ON "finance_partner"("agencyId", "name");

-- CreateIndex
CREATE INDEX "finance_entry_share_partnerId_idx" ON "finance_entry_share"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_entry_share_financeEntryId_partnerId_key" ON "finance_entry_share"("financeEntryId", "partnerId");

-- CreateIndex
CREATE INDEX "client_partner_share_partnerId_idx" ON "client_partner_share"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "client_partner_share_clientId_partnerId_key" ON "client_partner_share"("clientId", "partnerId");

-- AddForeignKey
ALTER TABLE "finance_partner" ADD CONSTRAINT "finance_partner_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry_share" ADD CONSTRAINT "finance_entry_share_financeEntryId_fkey" FOREIGN KEY ("financeEntryId") REFERENCES "finance_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entry_share" ADD CONSTRAINT "finance_entry_share_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "finance_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_partner_share" ADD CONSTRAINT "client_partner_share_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_partner_share" ADD CONSTRAINT "client_partner_share_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "finance_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

