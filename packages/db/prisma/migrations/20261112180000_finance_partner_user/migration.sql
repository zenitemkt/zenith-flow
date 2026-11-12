-- Sócio ligado a um login: lançamentos particulares ficam visíveis só para esse usuário.

-- AlterTable
ALTER TABLE "finance_partner" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "finance_partner_agencyId_userId_key" ON "finance_partner"("agencyId", "userId");

-- AddForeignKey
ALTER TABLE "finance_partner" ADD CONSTRAINT "finance_partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

