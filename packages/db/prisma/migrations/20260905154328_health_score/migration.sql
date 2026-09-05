-- CreateTable
CREATE TABLE "health_score_snapshot" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "computedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_score_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_score_snapshot_agencyId_idx" ON "health_score_snapshot"("agencyId");

-- CreateIndex
CREATE INDEX "health_score_snapshot_clientId_idx" ON "health_score_snapshot"("clientId");

-- AddForeignKey
ALTER TABLE "health_score_snapshot" ADD CONSTRAINT "health_score_snapshot_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_score_snapshot" ADD CONSTRAINT "health_score_snapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

