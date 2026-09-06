-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "convertedRequestId" TEXT,
ADD COLUMN     "convertedTaskId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "comment_convertedTaskId_key" ON "comment"("convertedTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_convertedRequestId_key" ON "comment"("convertedRequestId");

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_convertedTaskId_fkey" FOREIGN KEY ("convertedTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_convertedRequestId_fkey" FOREIGN KEY ("convertedRequestId") REFERENCES "request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
