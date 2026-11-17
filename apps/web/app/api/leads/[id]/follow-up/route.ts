import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { waPhone } from "@/lib/assistant/form-outreach";

/**
 * "Retomar conversa": a equipe abriu o wa.me para mandar a mensagem de retomada pelo celular.
 * Não envia nada pelo servidor. Se a Milena está conduzindo, a mensagem do celular conta como
 * dela (o eco da Meta não pausa a assistente) e ela segue quando o lead responder.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const agencyId = membership.agencyId;
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, agencyId },
    select: { id: true, phone: true, phones: { select: { value: true }, orderBy: { firstSeenAt: "asc" } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  const phone = waPhone(lead.phone ?? lead.phones[0]?.value);
  if (!phone) return NextResponse.json({ error: "O lead não tem um celular válido." }, { status: 400 });

  const conv = await prisma.assistantConversation.findUnique({ where: { agencyId_phone: { agencyId, phone } }, select: { id: true, mode: true } });
  if (!conv) return NextResponse.json({ error: "Ainda não há conversa com este lead." }, { status: 404 });
  await prisma.assistantConversation.update({
    where: { id: conv.id },
    data: { leadId: lead.id, ...(conv.mode === "bot" ? { autoTakeoverAt: new Date() } : {}) },
  });
  await prisma.auditLog.create({
    data: { agencyId, actorUserId: session.user.id, actorType: "user", action: "assistant.follow_up", resourceType: "lead", resourceId: lead.id, metadata: { phone, conversationId: conv.id } },
  });
  return NextResponse.json({ ok: true });
}
