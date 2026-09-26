import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getCurrentMembership, getServerSession } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem excluir leads." }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, name: true } });
  if (!lead || lead.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.deleteMany({ where: { agencyId: membership.agencyId, leadId: lead.id } });
    await tx.lead.delete({ where: { id: lead.id } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "lead.deleted",
        resourceType: "lead",
        resourceId: lead.id,
        metadata: { name: lead.name },
      },
    });
  });

  return NextResponse.json({ ok: true });
}