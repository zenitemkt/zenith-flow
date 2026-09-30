-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE');

-- CreateEnum
CREATE TYPE "AdConnectionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "ad_account_connection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "status" "AdConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_account_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_account_connection_agencyId_idx" ON "ad_account_connection"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_account_connection_agencyId_platform_key" ON "ad_account_connection"("agencyId", "platform");

-- AddForeignKey
ALTER TABLE "ad_account_connection" ADD CONSTRAINT "ad_account_connection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_account_connection" ADD CONSTRAINT "ad_account_connection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
