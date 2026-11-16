import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleLeadgenChange, leadsWebhookVerifyToken } from "@/lib/meta-lead-ads";
import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { recordInboxMessage } from "@/lib/social-inbox";

export const maxDuration = 60;

/** Handshake da assinatura `page/leadgen` (feita pelo próprio sistema ao ativar a integração). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === leadsWebhookVerifyToken()) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function validSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface MessengerEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: unknown[] };
}

/** Messenger: guarda as mensagens da Página na caixa de Conversas. */
async function handleMessenger(pageId: string, events: MessengerEvent[]) {
  const connection = await prisma.socialConnection.findFirst({ where: { platform: "FACEBOOK", externalId: pageId, status: "ACTIVE" } });
  if (!connection) return;
  for (const event of events) {
    const message = event.message;
    if (!message?.mid) continue;
    const echo = Boolean(message.is_echo);
    const participantId = echo ? event.recipient?.id : event.sender?.id;
    if (!participantId) continue;
    let participantName: string | null = null;
    if (!echo) {
      const existing = await prisma.socialInboxThread.findUnique({ where: { channel_accountId_participantId: { channel: "MESSENGER", accountId: pageId, participantId } }, select: { participantName: true } });
      if (!existing?.participantName) {
        const profile = await fetch(`https://graph.facebook.com/v22.0/${participantId}?fields=first_name,last_name&access_token=${encodeURIComponent(decryptSecret(connection.accessTokenEnc))}`)
          .then((r) => r.json())
          .catch(() => null);
        participantName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
      }
    }
    await recordInboxMessage({
      agencyId: connection.agencyId,
      clientId: connection.clientId,
      channel: "MESSENGER",
      accountId: pageId,
      participantId,
      participantName,
      direction: echo ? "out" : "in",
      author: echo ? "team" : "contact",
      text: message.text ?? (message.attachments?.length ? "[mídia]" : "[mensagem]"),
      externalId: message.mid,
    });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 403 });
  const payload = JSON.parse(rawBody) as {
    object?: string;
    entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: Record<string, string> }>; messaging?: Array<MessengerEvent> }>;
  };
  if (payload.object === "page") {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen" && change.value) await handleLeadgenChange(change.value);
      }
      if (entry.id && entry.messaging?.length) await handleMessenger(entry.id, entry.messaging).catch((error) => console.error("messenger_inbox_failed", error));
    }
  }
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
