-- AlterTable
ALTER TABLE "task" ADD COLUMN     "stageId" TEXT;

-- CreateTable
CREATE TABLE "operation_stage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_stage_agencyId_idx" ON "operation_stage"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "operation_stage_agencyId_order_key" ON "operation_stage"("agencyId", "order");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "operation_stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_stage" ADD CONSTRAINT "operation_stage_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

