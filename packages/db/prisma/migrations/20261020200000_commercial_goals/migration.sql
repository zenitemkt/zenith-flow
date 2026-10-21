-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('ACTIVE_CLIENTS', 'NEW_CLIENTS', 'REVENUE', 'RECEIVED', 'WON_DEALS_VALUE', 'NEW_LEADS');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('MONTHLY', 'QUARTERLY');

-- CreateTable
CREATE TABLE "commercial_goal" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT,
    "metric" "GoalMetric" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "target" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercial_goal_agencyId_metric_period_periodStart_key" ON "commercial_goal"("agencyId", "metric", "period", "periodStart");

-- CreateIndex
CREATE INDEX "commercial_goal_agencyId_periodStart_idx" ON "commercial_goal"("agencyId", "periodStart");

-- AddForeignKey
ALTER TABLE "commercial_goal" ADD CONSTRAINT "commercial_goal_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
