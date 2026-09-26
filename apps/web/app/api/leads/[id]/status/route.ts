import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canTransitionLead } from "@/lib/leads";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { advanceLeadCommercialFlow } from "@/lib/commercial-flow";
import { prisma, type LeadStatus } from "@zenite-mkt/db";

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
    if (toStatus === "EM_ANDAMENTO" || toStatus === "QUALIFICADO") {
      await advanceLeadCommercialFlow(tx, {
        agencyId: membership.agencyId,
        leadId: lead.id,
        targetStatus: toStatus,
        targetStage: toStatus === "EM_ANDAMENTO" ? "IN_PROGRESS" : "QUALIFIED",
        actorUserId: session.user.id,
        reason: `Lead marcado como ${toStatus === "EM_ANDAMENTO" ? "Em andamento" : "Qualificado"}`,
      });
      return;
    }
    await tx.lead.update({
      where: { id: lead.id },
      data: { status: toStatus, disqualifiedReason: reason },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: lead.id, fromStatus: lead.status, toStatus, reason, actorUserId: session.user.id },
    });
  });

  if (toStatus === "QUALIFICADO") {
    await fireWorkflowTrigger(membership.agencyId, "lead.qualified", "lead", lead.id, {
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      source: lead.source,
    });
  }

  return NextResponse.json({ ok: true });
}
