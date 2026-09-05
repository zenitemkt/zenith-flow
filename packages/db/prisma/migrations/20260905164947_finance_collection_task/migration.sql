-- AlterTable
ALTER TABLE "finance_entry" ADD COLUMN     "collectionTaskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "finance_entry_collectionTaskId_key" ON "finance_entry"("collectionTaskId");

-- AddForeignKey
ALTER TABLE "finance_entry" ADD CONSTRAINT "finance_entry_collectionTaskId_fkey" FOREIGN KEY ("collectionTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

