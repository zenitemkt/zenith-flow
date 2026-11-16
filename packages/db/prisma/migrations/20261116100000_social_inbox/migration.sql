CREATE TABLE "social_inbox_thread" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "channel" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "participantName" TEXT,
    "participantUsername" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_inbox_thread_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_inbox_thread_channel_accountId_participantId_key" ON "social_inbox_thread"("channel", "accountId", "participantId");
CREATE INDEX "social_inbox_thread_agencyId_lastMessageAt_idx" ON "social_inbox_thread"("agencyId", "lastMessageAt");

CREATE TABLE "social_inbox_message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_inbox_message_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_inbox_message_externalId_key" ON "social_inbox_message"("externalId");
CREATE INDEX "social_inbox_message_threadId_createdAt_idx" ON "social_inbox_message"("threadId", "createdAt");
ALTER TABLE "social_inbox_message" ADD CONSTRAINT "social_inbox_message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "social_inbox_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
