-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'PAUSADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('EXECUTANDO', 'AGUARDANDO', 'CONCLUIDO', 'FALHOU');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('CONDICAO', 'ESPERA', 'ACAO');

-- CreateTable
CREATE TABLE "workflow" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'RASCUNHO',
    "draftSteps" JSONB NOT NULL DEFAULT '[]',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_version" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "steps" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" TEXT,

    CONSTRAINT "workflow_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_run" (
    "id" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'EXECUTANDO',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "resumeAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_run" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepType" "WorkflowStepType" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_step_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_agencyId_idx" ON "workflow"("agencyId");

-- CreateIndex
CREATE INDEX "workflow_agencyId_triggerEvent_status_idx" ON "workflow"("agencyId", "triggerEvent", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_version_workflowId_version_key" ON "workflow_version"("workflowId", "version");

-- CreateIndex
CREATE INDEX "workflow_run_workflowVersionId_idx" ON "workflow_run"("workflowVersionId");

-- CreateIndex
CREATE INDEX "workflow_run_status_resumeAt_idx" ON "workflow_run"("status", "resumeAt");

-- CreateIndex
CREATE INDEX "workflow_step_run_workflowRunId_idx" ON "workflow_step_run"("workflowRunId");

-- AddForeignKey
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_version" ADD CONSTRAINT "workflow_version_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_run" ADD CONSTRAINT "workflow_run_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "workflow_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_run" ADD CONSTRAINT "workflow_step_run_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

