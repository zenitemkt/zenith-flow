-- Raio X fase 3: recomendações diárias.
ALTER TABLE "traffic_settings" ADD COLUMN "recommendationRules" JSONB;

CREATE TABLE "traffic_recommendation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "campaignName" TEXT,
    "reason" TEXT NOT NULL,
    "metrics" JSONB,
    "suggestedBudgetCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "traffic_recommendation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "traffic_recommendation_agencyId_status_idx" ON "traffic_recommendation"("agencyId", "status");
CREATE INDEX "traffic_recommendation_agencyId_type_targetId_idx" ON "traffic_recommendation"("agencyId", "type", "targetId");
ALTER TABLE "traffic_recommendation" ADD CONSTRAINT "traffic_recommendation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
