import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; geoTargetId: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const geoTarget = await prisma.campaignGeoTarget.findUnique({ where: { id: params.geoTargetId }, include: { campaign: true } });
  if (!geoTarget || geoTarget.campaignId !== params.id || geoTarget.campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Ponto de segmentação não encontrado." }, { status: 404 });
  }

  await prisma.campaignGeoTarget.delete({ where: { id: geoTarget.id } });

  return NextResponse.json({ ok: true });
}
