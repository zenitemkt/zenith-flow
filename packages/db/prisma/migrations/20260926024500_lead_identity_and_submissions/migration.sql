ALTER TABLE "lead"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

CREATE TABLE "lead_email" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_email_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_phone" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_phone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_submission" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "source" TEXT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "city" TEXT,
  "interest" TEXT,
  "service" TEXT,
  "employees" TEXT,
  "investment" TEXT,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_submission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "opportunity" ADD COLUMN "submissionId" TEXT;

CREATE UNIQUE INDEX "lead_email_agencyId_normalizedValue_key" ON "lead_email"("agencyId", "normalizedValue");
CREATE INDEX "lead_email_leadId_idx" ON "lead_email"("leadId");
CREATE UNIQUE INDEX "lead_phone_agencyId_normalizedValue_key" ON "lead_phone"("agencyId", "normalizedValue");
CREATE INDEX "lead_phone_leadId_idx" ON "lead_phone"("leadId");
CREATE INDEX "lead_submission_agencyId_createdAt_idx" ON "lead_submission"("agencyId", "createdAt");
CREATE INDEX "lead_submission_leadId_createdAt_idx" ON "lead_submission"("leadId", "createdAt");
CREATE UNIQUE INDEX "opportunity_submissionId_key" ON "opportunity"("submissionId");

ALTER TABLE "lead_email" ADD CONSTRAINT "lead_email_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_email" ADD CONSTRAINT "lead_email_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_phone" ADD CONSTRAINT "lead_phone_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_phone" ADD CONSTRAINT "lead_phone_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_submission" ADD CONSTRAINT "lead_submission_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_submission" ADD CONSTRAINT "lead_submission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "lead_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "lead"
SET
  "firstName" = split_part(trim("name"), ' ', 1),
  "lastName" = nullif(substr(trim("name"), length(split_part(trim("name"), ' ', 1)) + 2), '');

INSERT INTO "lead_email" ("id", "agencyId", "leadId", "value", "normalizedValue", "firstSeenAt", "lastSeenAt")
SELECT 'legacy_email_' || "id", "agencyId", "id", "email", lower(trim("email")), "createdAt", "updatedAt"
FROM "lead"
WHERE "email" IS NOT NULL AND trim("email") <> '';

WITH normalized AS (
  SELECT
    "id",
    "agencyId",
    "phone",
    "createdAt",
    "updatedAt",
    regexp_replace("phone", '[^0-9]', '', 'g') AS digits
  FROM "lead"
  WHERE "phone" IS NOT NULL AND trim("phone") <> ''
), ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY "agencyId", CASE WHEN length(digits) IN (10, 11) THEN '55' || digits ELSE digits END
    ORDER BY "createdAt", "id"
  ) AS position
  FROM normalized
  WHERE digits <> ''
)
INSERT INTO "lead_phone" ("id", "agencyId", "leadId", "value", "normalizedValue", "firstSeenAt", "lastSeenAt")
SELECT
  'legacy_phone_' || "id",
  "agencyId",
  "id",
  "phone",
  CASE WHEN length(digits) IN (10, 11) THEN '55' || digits ELSE digits END,
  "createdAt",
  "updatedAt"
FROM ranked
WHERE position = 1;