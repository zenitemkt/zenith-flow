-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NOVA', 'TRIAGEM', 'AGUARDANDO_INFORMACAO', 'APROVADA', 'REJEITADA', 'CONVERTIDA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "request" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'NOVA',
    "priority" "RequestPriority",
    "requesterName" TEXT,
    "requestedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_comment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_agencyId_idx" ON "request"("agencyId");

-- CreateIndex
CREATE INDEX "request_clientId_idx" ON "request"("clientId");

-- CreateIndex
CREATE INDEX "request_comment_requestId_idx" ON "request_comment"("requestId");

-- CreateIndex
CREATE INDEX "request_status_history_requestId_idx" ON "request_status_history"("requestId");

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_comment" ADD CONSTRAINT "request_comment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
