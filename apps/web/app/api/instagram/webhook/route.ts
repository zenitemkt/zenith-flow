import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma, Prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { getAppBaseUrl } from "@/lib/meta-ads";
import {
  matchInstagramRule,
  pickPublicReplyVariation,
  sendInstagramDirectMessage,
  sendInstagramPrivateReplyToComment,
  sendInstagramPublicCommentReply,
  type MatchableRule,
  type MessageButton,
} from "@/lib/instagram-automation";

/**
 * Handshake único (seção 4.2 do Blueprint) — a Meta chama isso uma vez
 * quando o webhook é salvo no painel do app. Um secret só, pro app inteiro
 * (a Meta não dá um verify token por Página, só por app).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Assinado com a chave secreta do app DO INSTAGRAM (produto "API do Instagram"), não a do app principal da Meta — são apps diferentes. */
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signatureHeader.slice("sha256=".length);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

interface ResolvedTarget {
  agencyId: string;
  clientId: string;
  igToken: string;
  igAccountId: string;
}

/**
 * Casada pelo `messagingAccountId` (token IGAA), não pelo `externalId`
 * antigo (token de Página) — são IDs em espaços diferentes (seção 4.1,
 * correção de 2026-10-23).
 */
async function resolveTarget(igAccountId: string): Promise<ResolvedTarget | null> {
  const connection = await prisma.socialConnection.findFirst({
    where: { platform: "INSTAGRAM", messagingAccountId: igAccountId, status: "ACTIVE" },
  });
  if (!connection?.messagingAccessTokenEnc) return null;
  return {
    agencyId: connection.agencyId,
    clientId: connection.clientId,
    igToken: decryptSecret(connection.messagingAccessTokenEnc),
    igAccountId,
  };
}

/** Cria o log com `ON CONFLICT DO NOTHING` via unicidade do banco — só processa se realmente inseriu (seção "Por que message_id/comment_id são UNIQUE" do Blueprint). */
async function claimLog(data: Prisma.InstagramAutomationLogUncheckedCreateInput): Promise<{ id: string } | null> {
  try {
    const created = await prisma.instagramAutomationLog.create({ data, select: { id: true } });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null; // já processado
    throw error;
  }
}

async function loadActiveRules(agencyId: string, clientId: string): Promise<MatchableRule[]> {
  return prisma.instagramAutomationRule.findMany({
    where: { agencyId, clientId, active: true },
    select: { id: true, triggerType: true, keyword: true, mediaId: true, active: true },
  });
}

/** Troca os links reais da regra por URLs do nosso redirecionador de clique (seção 4.4 — a Meta só avisa leitura, não clique). */
function buildTrackedButtons(buttons: unknown, logId: string): { send: MessageButton[]; realUrls: string[] } {
  const parsed = Array.isArray(buttons) ? (buttons as Array<{ text?: string; url?: string }>) : [];
  const valid = parsed.filter((b): b is { text: string; url: string } => Boolean(b.text && b.url));
  return {
    send: valid.map((b, index) => ({ text: b.text, url: `${getAppBaseUrl()}/api/instagram/click/${logId}/${index}` })),
    realUrls: valid.map((b) => b.url),
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 403 });
  }
  const payload = JSON.parse(rawBody) as { entry?: Array<Record<string, unknown>> };

  for (const entry of payload.entry ?? []) {
    const igAccountId = String(entry.id ?? "");
    if (!igAccountId) continue;

    const messagingEvents = Array.isArray(entry.messaging) ? (entry.messaging as Array<Record<string, unknown>>) : [];
    const changeEvents = Array.isArray(entry.changes) ? (entry.changes as Array<Record<string, unknown>>) : [];

    for (const event of messagingEvents) {
      const senderId = (event.sender as { id?: string } | undefined)?.id;
      if (!senderId) continue;

      // Confirmação de leitura: não cria evento novo, só marca o já enviado.
      const read = event.read as { mid?: string } | undefined;
      if (read?.mid) {
        await prisma.instagramAutomationLog.updateMany({ where: { sentMessageId: read.mid, readAt: null }, data: { readAt: new Date() } });
        continue;
      }

      const message = event.message as { mid?: string; text?: string; reply_to?: { story?: unknown } } | undefined;
      if (!message?.mid) continue;
      const triggerType = message.reply_to?.story ? "story_reply" : "direct_message";

      const target = await resolveTarget(igAccountId);
      if (!target) continue;
      const claimed = await claimLog({
        agencyId: target.agencyId,
        clientId: target.clientId,
        senderIgsid: senderId,
        messageId: message.mid,
        receivedText: message.text ?? null,
        status: "pending",
      });
      if (!claimed) continue;

      const rules = await loadActiveRules(target.agencyId, target.clientId);
      const rule = matchInstagramRule(rules, { triggerType, text: message.text ?? null });
      if (!rule) {
        await prisma.instagramAutomationLog.update({ where: { id: claimed.id }, data: { status: "no_match" } });
        continue;
      }
      const fullRule = await prisma.instagramAutomationRule.findUnique({ where: { id: rule.id } });
      if (!fullRule) continue;
      const { send: sendButtons, realUrls } = buildTrackedButtons(fullRule.buttons, claimed.id);
      try {
        const sentMessageId = await sendInstagramDirectMessage(target.igToken, target.igAccountId, senderId, {
          text: fullRule.responseText,
          buttons: sendButtons,
        });
        await prisma.instagramAutomationLog.update({
          where: { id: claimed.id },
          data: { status: "sent", sentText: fullRule.responseText, buttonUrls: realUrls, ruleId: fullRule.id, sentMessageId },
        });
      } catch (error) {
        await prisma.instagramAutomationLog.update({
          where: { id: claimed.id },
          data: { status: "failed", error: error instanceof Error ? error.message : "Erro desconhecido.", ruleId: fullRule.id },
        });
      }
    }

    for (const change of changeEvents) {
      if (change.field !== "comments") continue;
      const value = change.value as { from?: { id?: string }; comment_id?: string; id?: string; text?: string; media?: { id?: string }; parent_id?: string } | undefined;
      if (!value || value.parent_id) continue; // só comentário de primeiro nível (seção 4.3)
      const commentId = value.comment_id ?? value.id;
      const senderId = value.from?.id;
      if (!commentId || !senderId) continue;

      const target = await resolveTarget(igAccountId);
      if (!target) continue;
      const claimed = await claimLog({
        agencyId: target.agencyId,
        clientId: target.clientId,
        senderIgsid: senderId,
        commentId,
        receivedText: value.text ?? null,
        status: "pending",
      });
      if (!claimed) continue;

      const rules = await loadActiveRules(target.agencyId, target.clientId);
      const rule = matchInstagramRule(rules, { triggerType: "comment", text: value.text ?? null, mediaId: value.media?.id ?? null });
      if (!rule) {
        await prisma.instagramAutomationLog.update({ where: { id: claimed.id }, data: { status: "no_match" } });
        continue;
      }
      const fullRule = await prisma.instagramAutomationRule.findUnique({ where: { id: rule.id } });
      if (!fullRule) continue;
      const { send: sendButtons, realUrls } = buildTrackedButtons(fullRule.buttons, claimed.id);
      try {
        const sentMessageId = await sendInstagramPrivateReplyToComment(target.igToken, target.igAccountId, commentId, {
          text: fullRule.responseText,
          buttons: sendButtons,
        });
        const publicText = pickPublicReplyVariation(fullRule.publicReplyTexts);
        if (publicText) await sendInstagramPublicCommentReply(target.igToken, commentId, publicText);
        await prisma.instagramAutomationLog.update({
          where: { id: claimed.id },
          data: { status: "sent", sentText: fullRule.responseText, buttonUrls: realUrls, ruleId: fullRule.id, sentMessageId },
        });
      } catch (error) {
        await prisma.instagramAutomationLog.update({
          where: { id: claimed.id },
          data: { status: "failed", error: error instanceof Error ? error.message : "Erro desconhecido.", ruleId: fullRule.id },
        });
      }
    }
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
