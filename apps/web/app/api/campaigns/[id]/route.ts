import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getCurrentMembership, getServerSession } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";

interface RouteParams { params: { id: string } }

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir campanhas." }, { status: 403 });
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, name: true } });
  if (!campaign || campaign.agencyId !== membership.agencyId) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.campaign.delete({ where: { id: campaign.id } });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "campaign.deleted", resourceType: "campaign", resourceId: campaign.id, metadata: { name: campaign.name } } });
  });
  return NextResponse.json({ ok: true });
}
