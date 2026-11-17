CREATE TYPE "CompetitorCategory" AS ENUM ('DIRECT', 'REFERENCE');
ALTER TABLE "competitor" ADD COLUMN "category" "CompetitorCategory" NOT NULL DEFAULT 'DIRECT';
CREATE INDEX "competitor_clientId_category_idx" ON "competitor"("clientId", "category");
