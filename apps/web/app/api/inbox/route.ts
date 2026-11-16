import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { sendText } from "@/lib/assistant/whatsapp";
import { loadMessagingTarget } from "@/lib/instagram-flow";
import { sendInstagramDirectMessage } from "@/lib/instagram-automation";
import { recordInboxMessage } from "@/lib/social-inbox";
import { decryptSecret } from "@/lib/crypto-secrets";
import { subscribePageToMessages } from "@/lib/meta-lead-ads";

/** Caixa de conversas: responder (WhatsApp ou Direct) e assumir/devolver a conversa para a Milena. */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const [kind, id] = String(body?.key ?? "").split(":");
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";

  if (kind === "wa") {
    const conv = await prisma.assistantConversation.findFirst({ where: { id, agencyId: membership.agencyId } });
    if (!conv) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    if (body?.action === "clear") {
      await prisma.assistantMessage.deleteMany({ where: { conversationId: conv.id } });
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "delete") {
      await prisma.assistantConversation.delete({ where: { id: conv.id } });
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "mode") {
      const mode = body.mode === "bot" ? "bot" : "human";
      await prisma.assistantConversation.update({ where: { id: conv.id }, data: { mode, replyDueAt: null } });
      return NextResponse.json({ ok: true });
    }
    if (!text) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
    if (!conv.lastInboundAt || Date.now() - conv.lastInboundAt.getTime() > 24 * 3600_000) {
      return NextResponse.json({ error: "Passou de 24h desde a última mensagem do contato. O WhatsApp só deixa responder com modelo aprovado." }, { status: 400 });
    }
    try {
      const waMessageId = await sendText(conv.phone, text);
      await prisma.assistantMessage.create({ data: { conversationId: conv.id, role: "partner", content: text, waMessageId } });
      // Quem responde pela caixa assume a conversa: a Milena para de responder esse contato.
      await prisma.assistantConversation.update({ where: { id: conv.id }, data: { mode: "human", replyDueAt: null } });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao enviar." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  // Liga o Messenger: assina as mensagens das Páginas conectadas.
  if (body?.action === "connect-messenger") {
    const pages = await prisma.socialConnection.findMany({ where: { agencyId: membership.agencyId, platform: "FACEBOOK", status: "ACTIVE" } });
    if (!pages.length) return NextResponse.json({ error: "Nenhuma Página do Facebook conectada." }, { status: 409 });
    const results: string[] = [];
    for (const page of pages) {
      try {
        await subscribePageToMessages(page.externalId, decryptSecret(page.accessTokenEnc), page.leadsEnabled);
        results.push(`${page.name}: ligado`);
      } catch (error) {
        results.push(`${page.name}: ${error instanceof Error ? error.message : "falhou"}`);
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  if (kind === "ig") {
    const thread = await prisma.socialInboxThread.findFirst({ where: { id, agencyId: membership.agencyId } });
    if (!thread) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    if (body?.action === "clear") {
      await prisma.socialInboxMessage.deleteMany({ where: { threadId: thread.id } });
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "delete") {
      await prisma.socialInboxThread.delete({ where: { id: thread.id } });
      return NextResponse.json({ ok: true });
    }
    if (!text) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
    if (!thread.lastInboundAt || Date.now() - thread.lastInboundAt.getTime() > 24 * 3600_000) {
      return NextResponse.json({ error: "Passou de 24h desde a última mensagem do contato. O Instagram não deixa responder depois disso." }, { status: 400 });
    }
    if (thread.channel === "MESSENGER") {
      const page = await prisma.socialConnection.findFirst({ where: { agencyId: thread.agencyId, platform: "FACEBOOK", externalId: thread.accountId, status: "ACTIVE" } });
      if (!page) return NextResponse.json({ error: "Página desconectada." }, { status: 409 });
      const res = await fetch(`https://graph.facebook.com/v22.0/${thread.accountId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: thread.participantId }, messaging_type: "RESPONSE", message: { text }, access_token: decryptSecret(page.accessTokenEnc) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return NextResponse.json({ error: `Messenger: ${data?.error?.message ?? res.status}` }, { status: 502 });
      await recordInboxMessage({ agencyId: thread.agencyId, clientId: thread.clientId, channel: "MESSENGER", accountId: thread.accountId, participantId: thread.participantId, direction: "out", author: "team", text, externalId: data?.message_id ?? null });
      return NextResponse.json({ ok: true });
    }
    const target = await loadMessagingTarget({ igAccountId: thread.accountId });
    if (!target) return NextResponse.json({ error: "Instagram desconectado." }, { status: 409 });
    try {
      const mid = await sendInstagramDirectMessage(target.igToken, target.igAccountId, thread.participantId, { text });
      await recordInboxMessage({ agencyId: thread.agencyId, clientId: thread.clientId, channel: "INSTAGRAM", accountId: thread.accountId, participantId: thread.participantId, direction: "out", author: "team", text, externalId: mid });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao enviar." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Conversa inválida." }, { status: 400 });
}
