ALTER TABLE "competitor" ADD COLUMN "websiteSeoScore" INTEGER;
ALTER TABLE "competitor" ADD COLUMN "seoChecks" JSONB;
ALTER TABLE "competitor" ADD COLUMN "seoCheckedAt" TIMESTAMP(3);
ALTER TABLE "competitor" ADD COLUMN "seoError" TEXT;
ALTER TABLE "competitor" ADD COLUMN "googleProfileChecks" JSONB;
