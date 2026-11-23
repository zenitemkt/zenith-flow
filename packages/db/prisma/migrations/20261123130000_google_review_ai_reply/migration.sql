-- AlterTable
ALTER TABLE "google_business_review_policy" DROP COLUMN "fourStarTemplate",
DROP COLUMN "fiveStarTemplate",
ADD COLUMN     "extraGuidelines" TEXT;
