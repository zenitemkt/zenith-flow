-- CreateEnum
CREATE TYPE "CommentThreadStatus" AS ENUM ('ABERTA', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('ATIVO', 'EDITADO', 'REMOVIDO');

-- DropForeignKey
ALTER TABLE "content_comment" DROP CONSTRAINT "content_comment_contentItemId_fkey";

-- DropForeignKey
ALTER TABLE "request_comment" DROP CONSTRAINT "request_comment_requestId_fkey";

-- DropTable
DROP TABLE "content_comment";

-- DropTable
DROP TABLE "request_comment";

-- CreateTable
CREATE TABLE "comment_thread" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "CommentThreadStatus" NOT NULL DEFAULT 'ABERTA',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'ATIVO',
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_edit" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "previousBody" TEXT NOT NULL,
    "editedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_edit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_thread_agencyId_idx" ON "comment_thread"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_thread_entityType_entityId_key" ON "comment_thread"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "comment_threadId_idx" ON "comment"("threadId");

-- CreateIndex
CREATE INDEX "comment_edit_commentId_idx" ON "comment_edit"("commentId");

-- CreateIndex
CREATE INDEX "comment_mention_commentId_idx" ON "comment_mention"("commentId");

-- CreateIndex
CREATE INDEX "comment_mention_mentionedUserId_idx" ON "comment_mention"("mentionedUserId");

-- AddForeignKey
ALTER TABLE "comment_thread" ADD CONSTRAINT "comment_thread_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "comment_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_edit" ADD CONSTRAINT "comment_edit_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

