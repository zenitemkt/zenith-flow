-- CreateEnum
CREATE TYPE "RoutineStatus" AS ENUM ('RASCUNHO', 'ATIVO', 'PAUSADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "RoutineRunStatus" AS ENUM ('AGENDADA', 'CRIADA', 'IGNORADA', 'FALHOU');

-- CreateTable
CREATE TABLE "routine_template" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "status" "RoutineStatus" NOT NULL DEFAULT 'RASCUNHO',
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_template_task" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "routine_template_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_run" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "RoutineRunStatus" NOT NULL DEFAULT 'AGENDADA',
    "projectId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routine_template_agencyId_idx" ON "routine_template"("agencyId");

-- CreateIndex
CREATE INDEX "routine_template_clientId_idx" ON "routine_template"("clientId");

-- CreateIndex
CREATE INDEX "routine_template_task_templateId_idx" ON "routine_template_task"("templateId");

-- CreateIndex
CREATE INDEX "routine_run_templateId_idx" ON "routine_run"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "routine_run_templateId_period_key" ON "routine_run"("templateId", "period");

-- AddForeignKey
ALTER TABLE "routine_template" ADD CONSTRAINT "routine_template_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_template" ADD CONSTRAINT "routine_template_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_template_task" ADD CONSTRAINT "routine_template_task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "routine_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "routine_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

