CREATE TABLE "assistant_settings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assistant_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assistant_settings_agencyId_key" ON "assistant_settings"("agencyId");
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assistant_conversation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileName" TEXT,
    "leadId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'bot',
    "classification" TEXT,
    "replyDueAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "assistant_conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assistant_conversation_agencyId_phone_key" ON "assistant_conversation"("agencyId", "phone");
CREATE INDEX "assistant_conversation_replyDueAt_idx" ON "assistant_conversation"("replyDueAt");
ALTER TABLE "assistant_conversation" ADD CONSTRAINT "assistant_conversation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assistant_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaId" TEXT,
    "mediaType" TEXT,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_message_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "assistant_message_waMessageId_key" ON "assistant_message"("waMessageId");
CREATE INDEX "assistant_message_conversationId_createdAt_idx" ON "assistant_message"("conversationId", "createdAt");
ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "assistant_booking" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "meetUrl" TEXT,
    "calendarEventIds" JSONB,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "reminderSentAt" TIMESTAMP(3),
    "startNoticeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_booking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assistant_booking_agencyId_startsAt_idx" ON "assistant_booking"("agencyId", "startsAt");
ALTER TABLE "assistant_booking" ADD CONSTRAINT "assistant_booking_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assistant_booking" ADD CONSTRAINT "assistant_booking_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
