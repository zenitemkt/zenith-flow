-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('IDEIA', 'PAUTA', 'PRODUCAO', 'REVISAO_INTERNA', 'AGUARDANDO_CLIENTE', 'AJUSTES', 'APROVADO', 'AGENDADO', 'PUBLICADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "ContentChannel" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN', 'YOUTUBE', 'OUTRO');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDENTE', 'APROVADO', 'AJUSTES_SOLICITADOS');

-- CreateTable
CREATE TABLE "content_item" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel" "ContentChannel" NOT NULL,
    "format" TEXT,
    "campaign" TEXT,
    "caption" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'IDEIA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_version" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "assetUrl" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_approval" (
    "id" TEXT NOT NULL,
    "contentVersionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDENTE',
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comment" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_status_history" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "fromStatus" "ContentStatus",
    "toStatus" "ContentStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_item_agencyId_idx" ON "content_item"("agencyId");

-- CreateIndex
CREATE INDEX "content_item_clientId_idx" ON "content_item"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "content_version_contentItemId_versionNumber_key" ON "content_version"("contentItemId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "content_approval_contentVersionId_key" ON "content_approval"("contentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "content_approval_token_key" ON "content_approval"("token");

-- CreateIndex
CREATE INDEX "content_comment_contentItemId_idx" ON "content_comment"("contentItemId");

-- CreateIndex
CREATE INDEX "content_status_history_contentItemId_idx" ON "content_status_history"("contentItemId");

-- AddForeignKey
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_approval" ADD CONSTRAINT "content_approval_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "content_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comment" ADD CONSTRAINT "content_comment_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_status_history" ADD CONSTRAINT "content_status_history_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

