-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "finance_entry" ADD COLUMN     "boletoAssetId" TEXT;

-- CreateIndex
CREATE INDEX "campaign_clientId_idx" ON "campaign"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_entry_boletoAssetId_key" ON "finance_entry"("boletoAssetId");

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_boletoAssetId_fkey" FOREIGN KEY ("boletoAssetId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

