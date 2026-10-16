-- AlterTable
ALTER TABLE "blog_draft" ADD COLUMN "suggestedRelated" JSONB,
ADD COLUMN "suggestedFaq" JSONB,
ADD COLUMN "suggestedCoverSearchTerm" TEXT;
