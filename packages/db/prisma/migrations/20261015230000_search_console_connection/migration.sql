-- CreateTable
CREATE TABLE "search_console_connection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "connectedByUserId" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_console_connection_agencyId_key" ON "search_console_connection"("agencyId");

-- AddForeignKey
ALTER TABLE "search_console_connection" ADD CONSTRAINT "search_console_connection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
