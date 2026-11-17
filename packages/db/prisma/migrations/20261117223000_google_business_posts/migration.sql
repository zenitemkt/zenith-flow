ALTER TABLE "social_post" ALTER COLUMN "connectionId" DROP NOT NULL;
ALTER TABLE "social_post" ADD COLUMN "googleBusinessLocationId" TEXT;
ALTER TABLE "social_post" ADD COLUMN "googleCallToAction" TEXT;
ALTER TABLE "social_post" ADD COLUMN "googleCallToActionUrl" TEXT;
CREATE INDEX "social_post_googleBusinessLocationId_idx" ON "social_post"("googleBusinessLocationId");
ALTER TABLE "social_post" ADD CONSTRAINT "social_post_googleBusinessLocationId_fkey" FOREIGN KEY ("googleBusinessLocationId") REFERENCES "google_business_location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
