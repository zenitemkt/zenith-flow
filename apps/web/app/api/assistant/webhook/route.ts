import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { loadAssistant } from "@/lib/assistant/agent";
import { assistantAgencyId } from "@/lib/assistant/calendar";
import { notifyPartners } from "@/lib/assistant/notify";
import { handleLeadButton, handlePartnerButton, replyAt } from "@/lib/assistant/process";
import { verifyWhatsappSignature } from "@/lib/assistant/whatsapp";

/** Webhook do WhatsApp (Cloud API, coexistência) da assistente virtual. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.ASSISTANT_WA_VERIFY_TOKEN) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

interface WaMessage {
  id: string;
  from: string;
  to?: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string; title: string } };
  button?: { payload?: string; text?: string };
  image?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  audio?: { id: string };
  video?: { id: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string };
}

function describe(m: WaMessage): { content: string; mediaId: string | null; mediaType: string | null } {
  switch (m.type) {
    case "text":
      return { content: m.text?.body ?? "", mediaId: null, mediaType: null };
    case "interactive":
      return { content: m.interactive?.button_reply?.title ?? "[resposta de botão]", mediaId: null, mediaType: null };
    case "button":
      return { content: m.button?.text ?? "[resposta de botão]", mediaId: null, mediaType: null };
    case "audio":
      return { content: "[áudio]", mediaId: m.audio?.id ?? null, mediaType: "audio" };
    case "image":
      return { content: m.image?.caption ? `[imagem] ${m.image.caption}` : "[imagem sem legenda]", mediaId: m.image?.id ?? null, mediaType: "image" };
    case "document":
      return { content: `[documento ${m.document?.filename ?? ""}] ${m.document?.caption ?? ""}`.trim(), mediaId: m.document?.id ?? null, mediaType: "document" };
    case "video":
      return { content: `[vídeo] ${m.video?.caption ?? ""}`.trim(), mediaId: null, mediaType: "video" };
    case "sticker":
      return { content: "[figurinha]", mediaId: null, mediaType: "sticker" };
    case "location":
      return { content: `[localização] ${m.location?.name ?? ""} ${m.location?.latitude},${m.location?.longitude}`, mediaId: null, mediaType: "other" };
    default:
      return { content: `[mensagem do tipo ${m.type}]`, mediaId: null, mediaType: "other" };
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWhatsappSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("invalid signature", { status: 401 });
  const agencyId = assistantAgencyId();
  if (!agencyId) return NextResponse.json({ ok: true });
  const { enabled, config } = await loadAssistant(agencyId);
  const partners = new Set(config.notifications.partnerPhones.map((p) => p.replace(/\D/g, "")));
  const payload = JSON.parse(raw);

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const profiles = new Map<string, string>((value.contacts ?? []).map((c: { wa_id: string; profile?: { name?: string } }) => [c.wa_id, c.profile?.name ?? ""]));

      // Coexistência: mensagem enviada pela equipe pelo app do celular. A equipe assumiu, a assistente pausa.
      for (const echo of (value.message_echoes ?? []) as WaMessage[]) {
        const conv = echo.to ? await prisma.assistantConversation.findUnique({ where: { agencyId_phone: { agencyId, phone: echo.to } } }) : null;
        if (!conv) continue;
        await prisma.assistantMessage.upsert({ where: { waMessageId: echo.id }, create: { conversationId: conv.id, role: "partner", content: describe(echo).content, waMessageId: echo.id }, update: {} });
        await prisma.assistantConversation.update({ where: { id: conv.id }, data: { mode: "human", replyDueAt: null } });
      }

      for (const message of (value.messages ?? []) as WaMessage[]) {
        const buttonId = message.interactive?.button_reply?.id ?? message.button?.payload ?? null;
        if (partners.has(message.from)) {
          if (buttonId && /^(approve|deny)_/.test(buttonId)) await handlePartnerButton(agencyId, buttonId);
          continue;
        }
        if (!enabled) continue;

        let conv = await prisma.assistantConversation.findUnique({ where: { agencyId_phone: { agencyId, phone: message.from } } });
        const isNew = !conv;
        if (!conv) conv = await prisma.assistantConversation.create({ data: { agencyId, phone: message.from, profileName: profiles.get(message.from) || null } });
        const { content, mediaId, mediaType } = describe(message);
        const stored = await prisma.assistantMessage.upsert({ where: { waMessageId: message.id }, create: { conversationId: conv.id, role: "user", content, mediaId, mediaType, waMessageId: message.id }, update: {} });
        if (stored.createdAt.getTime() < Date.now() - 60_000) continue; // reenvio da Meta, já tratado

        if (buttonId && /^(confirm|cancel)_/.test(buttonId)) {
          await handleLeadButton(agencyId, buttonId);
          continue;
        }
        if (isNew && config.notifications.onNewContact) {
          await notifyPartners(config, `${config.name}: novo contato no WhatsApp, ${profiles.get(message.from) || "sem nome"} (+${message.from}).`).catch(() => null);
        }
        if (conv.mode === "bot") {
          await prisma.assistantConversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date(), replyDueAt: replyAt(config.replyDelaySeconds) } });
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
