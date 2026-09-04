-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('BACKLOG', 'PLANEJADA', 'EM_ANDAMENTO', 'BLOQUEADA', 'REVISAO', 'CONCLUIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "request" ADD COLUMN     "convertedTaskId" TEXT;

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'BACKLOG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'BACKLOG',
    "blockedByTaskId" TEXT,
    "assigneeUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromStatus" "WorkItemStatus",
    "toStatus" "WorkItemStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_agencyId_idx" ON "project"("agencyId");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "project"("clientId");

-- CreateIndex
CREATE INDEX "task_projectId_idx" ON "task"("projectId");

-- CreateIndex
CREATE INDEX "task_status_history_taskId_idx" ON "task_status_history"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "request_convertedTaskId_key" ON "request"("convertedTaskId");

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_convertedTaskId_fkey" FOREIGN KEY ("convertedTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_blockedByTaskId_fkey" FOREIGN KEY ("blockedByTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

