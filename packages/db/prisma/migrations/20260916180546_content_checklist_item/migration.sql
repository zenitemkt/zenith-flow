-- CreateTable
CREATE TABLE "content_checklist_item" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_checklist_item_contentItemId_idx" ON "content_checklist_item"("contentItemId");

-- AddForeignKey
ALTER TABLE "content_checklist_item" ADD CONSTRAINT "content_checklist_item_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
