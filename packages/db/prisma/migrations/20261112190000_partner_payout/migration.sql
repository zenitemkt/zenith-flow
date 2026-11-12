-- Pagamentos de repasse ao sócio no fechamento do mês (vários por mês, valor digitado).

-- CreateTable
CREATE TABLE "partner_payout" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "paidByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_payout_agencyId_idx" ON "partner_payout"("agencyId");

-- CreateIndex
CREATE INDEX "partner_payout_partnerId_month_idx" ON "partner_payout"("partnerId", "month");

-- AddForeignKey
ALTER TABLE "partner_payout" ADD CONSTRAINT "partner_payout_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payout" ADD CONSTRAINT "partner_payout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "finance_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

