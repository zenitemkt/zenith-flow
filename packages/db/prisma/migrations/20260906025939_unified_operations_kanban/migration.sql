-- CreateEnum
CREATE TYPE "RecurrenceMode" AS ENUM ('MENSAL', 'DATAS_ESPECIFICAS');

-- CreateEnum
CREATE TYPE "RecurringTaskStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'PAUSADO');

-- DropForeignKey
ALTER TABLE "client_allocation" DROP CONSTRAINT "client_allocation_clientId_fkey";

-- DropForeignKey
ALTER TABLE "client_allocation" DROP CONSTRAINT "client_allocation_squadId_fkey";

-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_convertedRequestId_fkey";

-- DropForeignKey
ALTER TABLE "request" DROP CONSTRAINT "request_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "request" DROP CONSTRAINT "request_clientId_fkey";

-- DropForeignKey
ALTER TABLE "request" DROP CONSTRAINT "request_convertedTaskId_fkey";

-- DropForeignKey
ALTER TABLE "request_status_history" DROP CONSTRAINT "request_status_history_requestId_fkey";

-- DropForeignKey
ALTER TABLE "routine_run" DROP CONSTRAINT "routine_run_projectId_fkey";

-- DropForeignKey
ALTER TABLE "routine_run" DROP CONSTRAINT "routine_run_templateId_fkey";

-- DropForeignKey
ALTER TABLE "routine_template" DROP CONSTRAINT "routine_template_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "routine_template" DROP CONSTRAINT "routine_template_clientId_fkey";

-- DropForeignKey
ALTER TABLE "routine_template_task" DROP CONSTRAINT "routine_template_task_templateId_fkey";

-- DropForeignKey
ALTER TABLE "squad" DROP CONSTRAINT "squad_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "squad_member" DROP CONSTRAINT "squad_member_squadId_fkey";

-- DropForeignKey
ALTER TABLE "squad_member" DROP CONSTRAINT "squad_member_userId_fkey";

-- DropIndex
DROP INDEX "comment_convertedRequestId_key";

-- AlterTable
ALTER TABLE "comment" DROP COLUMN "convertedRequestId";

-- DropTable
DROP TABLE "client_allocation";

-- DropTable
DROP TABLE "request";

-- DropTable
DROP TABLE "request_status_history";

-- DropTable
DROP TABLE "routine_run";

-- DropTable
DROP TABLE "routine_template";

-- DropTable
DROP TABLE "routine_template_task";

-- DropTable
DROP TABLE "squad";

-- DropTable
DROP TABLE "squad_member";

-- DropEnum
DROP TYPE "AllocationStatus";

-- DropEnum
DROP TYPE "RequestPriority";

-- DropEnum
DROP TYPE "RequestStatus";

-- DropEnum
DROP TYPE "RoutineRunStatus";

-- DropEnum
DROP TYPE "RoutineStatus";

-- CreateTable
CREATE TABLE "task_assignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_item" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_task_template" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedMinutes" INTEGER,
    "recurrenceMode" "RecurrenceMode" NOT NULL,
    "dayOfMonth" INTEGER,
    "status" "RecurringTaskStatus" NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_task_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_task_assignee" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "recurring_task_assignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_task_checklist_item" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "recurring_task_checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_task_date" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_task_date_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_task_generation" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_task_generation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignee_taskId_idx" ON "task_assignee"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignee_taskId_order_key" ON "task_assignee"("taskId", "order");

-- CreateIndex
CREATE INDEX "task_checklist_item_taskId_idx" ON "task_checklist_item"("taskId");

-- CreateIndex
CREATE INDEX "recurring_task_template_agencyId_idx" ON "recurring_task_template"("agencyId");

-- CreateIndex
CREATE INDEX "recurring_task_template_clientId_idx" ON "recurring_task_template"("clientId");

-- CreateIndex
CREATE INDEX "recurring_task_assignee_templateId_idx" ON "recurring_task_assignee"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_task_assignee_templateId_order_key" ON "recurring_task_assignee"("templateId", "order");

-- CreateIndex
CREATE INDEX "recurring_task_checklist_item_templateId_idx" ON "recurring_task_checklist_item"("templateId");

-- CreateIndex
CREATE INDEX "recurring_task_date_templateId_idx" ON "recurring_task_date"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_task_date_templateId_date_key" ON "recurring_task_date"("templateId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_task_generation_taskId_key" ON "recurring_task_generation"("taskId");

-- CreateIndex
CREATE INDEX "recurring_task_generation_templateId_idx" ON "recurring_task_generation"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_task_generation_templateId_period_key" ON "recurring_task_generation"("templateId", "period");

-- AddForeignKey
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_item" ADD CONSTRAINT "task_checklist_item_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_template" ADD CONSTRAINT "recurring_task_template_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_template" ADD CONSTRAINT "recurring_task_template_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_assignee" ADD CONSTRAINT "recurring_task_assignee_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_task_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_checklist_item" ADD CONSTRAINT "recurring_task_checklist_item_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_task_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_date" ADD CONSTRAINT "recurring_task_date_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_task_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_generation" ADD CONSTRAINT "recurring_task_generation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "recurring_task_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_task_generation" ADD CONSTRAINT "recurring_task_generation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

