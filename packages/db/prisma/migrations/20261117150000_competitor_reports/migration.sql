CREATE TABLE "competitor_report" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "month" TIMESTAMP(3) NOT NULL,
  "content" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "competitor_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competitor_report_clientId_month_key" ON "competitor_report"("clientId", "month");
CREATE INDEX "competitor_report_clientId_generatedAt_idx" ON "competitor_report"("clientId", "generatedAt");

ALTER TABLE "competitor_report"
  ADD CONSTRAINT "competitor_report_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
