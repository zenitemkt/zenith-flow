CREATE TYPE "GoogleBusinessConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'REVOKED');

CREATE TABLE "google_business_connection" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "googleAccountEmail" TEXT,
  "refreshTokenEnc" TEXT NOT NULL,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "GoogleBusinessConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastValidatedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "connectedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_business_connection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "google_business_location" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "verified" BOOLEAN,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_business_location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_business_connection_agencyId_key" ON "google_business_connection"("agencyId");
CREATE UNIQUE INDEX "google_business_location_clientId_key" ON "google_business_location"("clientId");
CREATE UNIQUE INDEX "google_business_location_agencyId_locationId_key" ON "google_business_location"("agencyId", "locationId");
CREATE INDEX "google_business_location_agencyId_idx" ON "google_business_location"("agencyId");
ALTER TABLE "google_business_connection" ADD CONSTRAINT "google_business_connection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_location" ADD CONSTRAINT "google_business_location_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_location" ADD CONSTRAINT "google_business_location_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_location" ADD CONSTRAINT "google_business_location_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_business_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
