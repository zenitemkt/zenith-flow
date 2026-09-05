-- CreateEnum
CREATE TYPE "ChurnRiskBand" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "RetentionPlanStatus" AS ENUM ('ATIVO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "churn_risk_snapshot" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "band" "ChurnRiskBand" NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "signals" JSONB NOT NULL,
    "computedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "churn_risk_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_plan" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "alertReason" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "responsibleUserId" TEXT NOT NULL,
    "planDescription" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3),
    "reassessDate" TIMESTAMP(3),
    "status" "RetentionPlanStatus" NOT NULL DEFAULT 'ATIVO',
    "result" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_plan_status_history" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fromStatus" "RetentionPlanStatus",
    "toStatus" "RetentionPlanStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_plan_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "churn_risk_snapshot_agencyId_idx" ON "churn_risk_snapshot"("agencyId");

-- CreateIndex
CREATE INDEX "churn_risk_snapshot_clientId_idx" ON "churn_risk_snapshot"("clientId");

-- CreateIndex
CREATE INDEX "retention_plan_agencyId_idx" ON "retention_plan"("agencyId");

-- CreateIndex
CREATE INDEX "retention_plan_clientId_idx" ON "retention_plan"("clientId");

-- CreateIndex
CREATE INDEX "retention_plan_status_history_planId_idx" ON "retention_plan_status_history"("planId");

-- AddForeignKey
ALTER TABLE "churn_risk_snapshot" ADD CONSTRAINT "churn_risk_snapshot_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churn_risk_snapshot" ADD CONSTRAINT "churn_risk_snapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_plan" ADD CONSTRAINT "retention_plan_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_plan" ADD CONSTRAINT "retention_plan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_plan_status_history" ADD CONSTRAINT "retention_plan_status_history_planId_fkey" FOREIGN KEY ("planId") REFERENCES "retention_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

