ALTER TABLE "client" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client" ADD COLUMN "isAgencyOwn" BOOLEAN NOT NULL DEFAULT false;

UPDATE "client" SET "isDemo" = true WHERE name ILIKE 'demonstração' OR name ILIKE 'demonstracao';
UPDATE "client" SET "isAgencyOwn" = true WHERE name ILIKE 'zenite hub';
