-- AlterTable
ALTER TABLE "proposal" ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientEmailBcc" TEXT,
ADD COLUMN     "recipientEmailCc" TEXT,
ADD COLUMN     "recipientWhatsapp" TEXT,
ADD COLUMN     "timelineSteps" JSONB,
ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);
