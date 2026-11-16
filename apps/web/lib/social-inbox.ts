import { Prisma, prisma } from "@zenite-mkt/db";

/** Grava uma mensagem do Direct na caixa de conversas (sem duplicar pelo id da Meta). */
export async function recordInboxMessage(input: {
  agencyId: string;
  clientId: string | null;
  channel: "INSTAGRAM" | "MESSENGER";
  accountId: string;
  participantId: string;
  participantName?: string | null;
  participantUsername?: string | null;
  direction: "in" | "out";
  author: "contact" | "bot" | "team";
  text: string;
  externalId: string | null;
}) {
  const now = new Date();
  const thread = await prisma.socialInboxThread.upsert({
    where: { channel_accountId_participantId: { channel: input.channel, accountId: input.accountId, participantId: input.participantId } },
    create: {
      agencyId: input.agencyId,
      clientId: input.clientId,
      channel: input.channel,
      accountId: input.accountId,
      participantId: input.participantId,
      participantName: input.participantName ?? null,
      participantUsername: input.participantUsername ?? null,
      lastMessageAt: now,
      lastInboundAt: input.direction === "in" ? now : null,
    },
    update: {
      lastMessageAt: now,
      ...(input.direction === "in" ? { lastInboundAt: now } : {}),
      ...(input.participantName ? { participantName: input.participantName } : {}),
      ...(input.participantUsername ? { participantUsername: input.participantUsername } : {}),
    },
  });
  try {
    await prisma.socialInboxMessage.create({ data: { threadId: thread.id, direction: input.direction, author: input.author, text: input.text, externalId: input.externalId } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
}
