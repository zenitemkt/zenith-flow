-- CreateEnum
CREATE TYPE "EventDeliveryDestination" AS ENUM ('META', 'GA4');

-- CreateEnum
CREATE TYPE "EventDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- AlterTable
ALTER TABLE "ad_account_connection" ADD COLUMN     "metaPixelId" TEXT;

-- CreateTable
CREATE TABLE "event_delivery" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "trackingEventId" TEXT NOT NULL,
    "destination" "EventDeliveryDestination" NOT NULL,
    "status" "EventDeliveryStatus" NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_delivery_agencyId_attemptedAt_idx" ON "event_delivery"("agencyId", "attemptedAt");

-- CreateIndex
CREATE INDEX "event_delivery_trackingEventId_idx" ON "event_delivery"("trackingEventId");

-- AddForeignKey
ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_delivery" ADD CONSTRAINT "event_delivery_trackingEventId_fkey" FOREIGN KEY ("trackingEventId") REFERENCES "tracking_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
