import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { waPhone } from "@/lib/assistant/form-outreach";

/**
 * "Já mandei a primeira mensagem": liga a conversa ao lead e deixa a Milena pronta para
 * assumir quando o contato responder (sem custo de modelo de marketing, quem envia é a equipe).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe." }, { status: 403 });
  const agencyId = membership.agencyId;
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, agencyId },
    select: { id: true, name: true, phone: true, phones: { select: { value: true }, orderBy: { firstSeenAt: "asc" } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  const phone = waPhone(lead.phone ?? lead.phones[0]?.value);
  if (!phone) return NextResponse.json({ error: "O lead não tem um celular válido." }, { status: 400 });

  const now = new Date();
  const conv = await prisma.assistantConversation.upsert({
    where: { agencyId_phone: { agencyId, phone } },
    create: { agencyId, phone, leadId: lead.id, profileName: lead.name, mode: "bot", autoTakeoverAt: now },
    update: { leadId: lead.id, mode: "bot", autoTakeoverAt: now, replyDueAt: null, failures: 0 },
  });
  await prisma.auditLog.create({
    data: { agencyId, actorUserId: session.user.id, actorType: "user", action: "assistant.manual_opener", resourceType: "lead", resourceId: lead.id, metadata: { phone } },
  });
  return NextResponse.json({ ok: true, conversationKey: `wa:${conv.id}` });
}
