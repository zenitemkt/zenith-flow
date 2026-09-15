-- AlterTable
ALTER TABLE "task" ADD COLUMN     "currentRunStartedAt" TIMESTAMP(3),
ADD COLUMN     "currentRunUserId" TEXT;
