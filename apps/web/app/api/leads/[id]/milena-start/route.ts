import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { sendTemplate } from "@/lib/assistant/whatsapp";
import { loadAssistant } from "@/lib/assistant/agent";
import { FORM_TEMPLATE_NAME, FORM_TEMPLATE_TEXT, firstName, topicOf, waPhone } from "@/lib/assistant/form-outreach";

/**
 * A Milena chama no WhatsApp quem preencheu o formulário e não mandou mensagem.
 * A primeira mensagem é o modelo aprovado; quando a pessoa responde, a Milena segue
 * a conversa já com as respostas do formulário (card do lead ligado à conversa).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const agencyId = membership.agencyId;

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, agencyId },
    select: { id: true, name: true, phone: true, phones: { select: { value: true }, orderBy: { firstSeenAt: "asc" } }, submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { service: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  const phone = waPhone(lead.phone ?? lead.phones[0]?.value);
  if (!phone) return NextResponse.json({ error: "O lead não tem um celular válido." }, { status: 400 });

  const { enabled } = await loadAssistant(agencyId);
  if (!enabled) return NextResponse.json({ error: "Ligue a Milena antes (Automações > Assistente virtual)." }, { status: 409 });

  const existing = await prisma.assistantConversation.findUnique({ where: { agencyId_phone: { agencyId, phone } }, include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (existing?.messages[0] && Date.now() - existing.messages[0].createdAt.getTime() < 24 * 3600_000) {
    return NextResponse.json({ error: "Já existe conversa com esse contato nas últimas 24h. Acompanhe em Conversas." }, { status: 409 });
  }

  const name = firstName(lead.name);
  const topic = topicOf(lead.submissions[0]?.service);
  let waMessageId: string | null;
  try {
    waMessageId = await sendTemplate(phone, FORM_TEMPLATE_NAME, [name, topic]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const pending = /template|132001|132000|does not exist|not approved/i.test(message);
    return NextResponse.json({ error: pending ? `O modelo "${FORM_TEMPLATE_NAME}" ainda não foi aprovado pela Meta.` : `WhatsApp recusou: ${message.slice(0, 200)}` }, { status: 502 });
  }

  const conv = existing
    ? await prisma.assistantConversation.update({ where: { id: existing.id }, data: { leadId: lead.id, profileName: existing.profileName ?? lead.name, mode: "bot", replyDueAt: null, failures: 0 } })
    : await prisma.assistantConversation.create({ data: { agencyId, phone, leadId: lead.id, profileName: lead.name, mode: "bot" } });
  await prisma.assistantMessage.create({ data: { conversationId: conv.id, role: "assistant", content: FORM_TEMPLATE_TEXT(name, topic), waMessageId } });
  await prisma.auditLog.create({
    data: { agencyId, actorUserId: session.user.id, actorType: "user", action: "assistant.form_outreach", resourceType: "lead", resourceId: lead.id, metadata: { phone } },
  });
  return NextResponse.json({ ok: true, conversationKey: `wa:${conv.id}` });
}
