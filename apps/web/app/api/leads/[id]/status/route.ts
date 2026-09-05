import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionLead } from "@/lib/leads";
import { prisma, type LeadStatus } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/** CONVERTIDO nunca passa por aqui — precisa criar o Client junto, ver /api/leads/:id/convert. */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead || lead.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as LeadStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (toStatus === "CONVERTIDO") {
    return NextResponse.json({ error: "Use a ação 'Converter em cliente' para este status." }, { status: 400 });
  }
  if (!toStatus || !canTransitionLead(lead.status, toStatus)) {
    return NextResponse.json({ error: `Não é possível mudar de ${lead.status} para ${toStatus}.` }, { status: 400 });
  }
  if (toStatus === "DESQUALIFICADO" && !reason) {
    return NextResponse.json({ error: "Informe o motivo da desqualificação." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: toStatus, disqualifiedReason: toStatus === "DESQUALIFICADO" ? reason : lead.disqualifiedReason },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, fromStatus: lead.status, toStatus, reason, actorUserId: session.user.id },
    });
  });

  return NextResponse.json({ ok: true });
}
