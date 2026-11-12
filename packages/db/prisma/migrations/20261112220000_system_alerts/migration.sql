-- CreateEnum
CREATE TYPE "SystemAlertCategory" AS ENUM ('SITE', 'TRACKING', 'BLOG', 'SOCIAL', 'AUTOMATION', 'INTEGRATION');
CREATE TYPE "SystemAlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');
CREATE TYPE "SystemAlertStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "system_alert" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "SystemAlertCategory" NOT NULL,
    "severity" "SystemAlertSeverity" NOT NULL,
    "status" "SystemAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "href" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "autoResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_alert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_alert_agencyId_key_key" ON "system_alert"("agencyId", "key");
CREATE INDEX "system_alert_agencyId_status_lastSeenAt_idx" ON "system_alert"("agencyId", "status", "lastSeenAt");

ALTER TABLE "system_alert" ADD CONSTRAINT "system_alert_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
