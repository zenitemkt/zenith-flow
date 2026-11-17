CREATE TYPE "GoogleBusinessReviewStatus" AS ENUM ('PENDING_AUTO', 'PENDING_MANUAL', 'DRAFT', 'APPROVED', 'REPLIED', 'IGNORED', 'FAILED');
CREATE TYPE "GoogleBusinessReviewResponseAction" AS ENUM ('IMPORTED', 'DRAFT_SAVED', 'APPROVED', 'SENT', 'FAILED', 'IGNORED');

CREATE TABLE "google_business_review_policy" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "autoReplyFourStars" BOOLEAN NOT NULL DEFAULT true,
  "autoReplyFiveStars" BOOLEAN NOT NULL DEFAULT true,
  "manualAtOrBelow" INTEGER NOT NULL DEFAULT 3,
  "responseTone" TEXT NOT NULL DEFAULT 'Profissional, cordial e específico',
  "fourStarTemplate" TEXT NOT NULL,
  "fiveStarTemplate" TEXT NOT NULL,
  "notifyLowRatings" BOOLEAN NOT NULL DEFAULT true,
  "requireCommentForAuto" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_business_review_policy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "google_business_review" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "externalReviewId" TEXT NOT NULL,
  "reviewerName" TEXT,
  "reviewerPhotoUrl" TEXT,
  "starRating" INTEGER NOT NULL,
  "comment" TEXT,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "status" "GoogleBusinessReviewStatus" NOT NULL DEFAULT 'PENDING_MANUAL',
  "replyText" TEXT,
  "repliedAt" TIMESTAMP(3),
  "googleUpdatedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "google_business_review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_business_review_rating_check" CHECK ("starRating" BETWEEN 1 AND 5)
);

CREATE TABLE "google_business_review_response" (
  "id" TEXT NOT NULL,
  "agencyId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "action" "GoogleBusinessReviewResponseAction" NOT NULL,
  "text" TEXT,
  "actorUserId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_business_review_response_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_business_review_policy_agencyId_key" ON "google_business_review_policy"("agencyId");
CREATE UNIQUE INDEX "google_business_review_locationId_externalReviewId_key" ON "google_business_review"("locationId", "externalReviewId");
CREATE INDEX "google_business_review_agencyId_status_reviewedAt_idx" ON "google_business_review"("agencyId", "status", "reviewedAt");
CREATE INDEX "google_business_review_clientId_reviewedAt_idx" ON "google_business_review"("clientId", "reviewedAt");
CREATE INDEX "google_business_review_response_agencyId_createdAt_idx" ON "google_business_review_response"("agencyId", "createdAt");
CREATE INDEX "google_business_review_response_reviewId_createdAt_idx" ON "google_business_review_response"("reviewId", "createdAt");

ALTER TABLE "google_business_review_policy" ADD CONSTRAINT "google_business_review_policy_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_review" ADD CONSTRAINT "google_business_review_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_review" ADD CONSTRAINT "google_business_review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_review" ADD CONSTRAINT "google_business_review_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "google_business_location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_review_response" ADD CONSTRAINT "google_business_review_response_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_business_review_response" ADD CONSTRAINT "google_business_review_response_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "google_business_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
