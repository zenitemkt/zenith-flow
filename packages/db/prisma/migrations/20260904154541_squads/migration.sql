-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ATIVA', 'ENCERRADA');

-- CreateTable
CREATE TABLE "squad" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "squad_member" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "squad_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_allocation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ATIVA',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "squad_agencyId_idx" ON "squad"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "squad_member_squadId_userId_key" ON "squad_member"("squadId", "userId");

-- CreateIndex
CREATE INDEX "client_allocation_clientId_idx" ON "client_allocation"("clientId");

-- CreateIndex
CREATE INDEX "client_allocation_squadId_idx" ON "client_allocation"("squadId");

-- AddForeignKey
ALTER TABLE "squad" ADD CONSTRAINT "squad_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_member" ADD CONSTRAINT "squad_member_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "squad_member" ADD CONSTRAINT "squad_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_allocation" ADD CONSTRAINT "client_allocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_allocation" ADD CONSTRAINT "client_allocation_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

