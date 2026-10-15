-- CreateEnum
CREATE TYPE "BlogDraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "blog_draft" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "status" "BlogDraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "seoTitle" TEXT,
    "focusKeyword" TEXT,
    "cover" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "blog_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_draft_comment" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "agentReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "blog_draft_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_automation_connection" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "githubOwner" TEXT NOT NULL,
    "githubRepo" TEXT NOT NULL,
    "githubBranch" TEXT NOT NULL DEFAULT 'main',
    "githubTokenEnc" TEXT NOT NULL,
    "agentApiKeyEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_automation_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_draft_agencyId_slug_key" ON "blog_draft"("agencyId", "slug");

-- CreateIndex
CREATE INDEX "blog_draft_agencyId_status_idx" ON "blog_draft"("agencyId", "status");

-- CreateIndex
CREATE INDEX "blog_draft_comment_draftId_status_idx" ON "blog_draft_comment"("draftId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "content_automation_connection_agencyId_key" ON "content_automation_connection"("agencyId");

-- AddForeignKey
ALTER TABLE "blog_draft" ADD CONSTRAINT "blog_draft_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_draft_comment" ADD CONSTRAINT "blog_draft_comment_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "blog_draft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_automation_connection" ADD CONSTRAINT "content_automation_connection_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
