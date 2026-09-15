-- AlterTable
ALTER TABLE "content_item" ADD COLUMN     "assigneeUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
