-- AlterTable
ALTER TABLE "assistant_conversation" ADD COLUMN     "prospectId" TEXT;

-- AlterTable
ALTER TABLE "prospect" DROP COLUMN "nextContactAt",
DROP COLUMN "sequenceDay",
ADD COLUMN     "emailStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextEmailAt" TIMESTAMP(3),
ADD COLUMN     "optOutToken" TEXT,
ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "prospect_optOutToken_key" ON "prospect"("optOutToken");

