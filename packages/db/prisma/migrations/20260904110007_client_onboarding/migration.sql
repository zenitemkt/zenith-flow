-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'ONBOARDING', 'ATIVO', 'PAUSADO', 'EM_ENCERRAMENTO', 'ENCERRADO', 'REATIVADO');

-- CreateEnum
CREATE TYPE "OnboardingRunStatus" AS ENUM ('EM_ANDAMENTO', 'BLOQUEADO', 'PRONTO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OnboardingItemStatus" AS ENUM ('PENDENTE', 'BLOQUEADO', 'CONCLUIDO');

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'PROSPECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Geral',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_status_history" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromStatus" "ClientStatus",
    "toStatus" "ClientStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_note" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_template" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_template_item" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "onboarding_template_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_run" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "OnboardingRunStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "onboarding_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_item" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" "OnboardingItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,

    CONSTRAINT "onboarding_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_workspaceId_key" ON "client"("workspaceId");

-- CreateIndex
CREATE INDEX "client_agencyId_idx" ON "client"("agencyId");

-- CreateIndex
CREATE INDEX "client_contact_clientId_idx" ON "client_contact"("clientId");

-- CreateIndex
CREATE INDEX "client_status_history_clientId_idx" ON "client_status_history"("clientId");

-- CreateIndex
CREATE INDEX "client_note_clientId_idx" ON "client_note"("clientId");

-- CreateIndex
CREATE INDEX "onboarding_template_agencyId_idx" ON "onboarding_template"("agencyId");

-- CreateIndex
CREATE INDEX "onboarding_template_item_templateId_idx" ON "onboarding_template_item"("templateId");

-- CreateIndex
CREATE INDEX "onboarding_run_clientId_idx" ON "onboarding_run"("clientId");

-- CreateIndex
CREATE INDEX "onboarding_item_runId_idx" ON "onboarding_item"("runId");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contact" ADD CONSTRAINT "client_contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_status_history" ADD CONSTRAINT "client_status_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_template" ADD CONSTRAINT "onboarding_template_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_template_item" ADD CONSTRAINT "onboarding_template_item_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "onboarding_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_run" ADD CONSTRAINT "onboarding_run_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_run" ADD CONSTRAINT "onboarding_run_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "onboarding_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_item" ADD CONSTRAINT "onboarding_item_runId_fkey" FOREIGN KEY ("runId") REFERENCES "onboarding_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
