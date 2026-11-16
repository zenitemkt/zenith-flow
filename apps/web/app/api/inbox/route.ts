import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { sendText } from "@/lib/assistant/whatsapp";
import { loadMessagingTarget } from "@/lib/instagram-flow";
import { sendInstagramDirectMessage } from "@/lib/instagram-automation";
import { recordInboxMessage } from "@/lib/social-inbox";

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

  if (kind === "ig") {
    const thread = await prisma.socialInboxThread.findFirst({ where: { id, agencyId: membership.agencyId } });
    if (!thread) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    if (!text) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
    if (!thread.lastInboundAt || Date.now() - thread.lastInboundAt.getTime() > 24 * 3600_000) {
      return NextResponse.json({ error: "Passou de 24h desde a última mensagem do contato. O Instagram não deixa responder depois disso." }, { status: 400 });
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
