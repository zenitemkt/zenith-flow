-- AlterTable
ALTER TABLE "social_connection" ADD COLUMN     "messagingAccessTokenEnc" TEXT,
ADD COLUMN     "messagingTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "messagingAccountId" TEXT;
