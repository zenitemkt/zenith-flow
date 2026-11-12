CREATE TABLE "system_alert_settings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "disabledTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_alert_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "system_alert_settings_agencyId_key" ON "system_alert_settings"("agencyId");
ALTER TABLE "system_alert_settings" ADD CONSTRAINT "system_alert_settings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
