import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canViewEnps } from "@/lib/rbac";
import { computeEnpsBreakdown } from "@/lib/enps";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (!canViewEnps(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const campaign = await prisma.enpsCampaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }

  const responses = await prisma.enpsResponse.findMany({
    where: { campaignId: campaign.id },
    select: { score: true },
  });
  const breakdown = computeEnpsBreakdown(responses.map((r) => r.score));

  const snapshot = await prisma.enpsSnapshot.create({
    data: {
      agencyId: membership.agencyId,
      campaignId: campaign.id,
      score: breakdown.score,
      promoters: breakdown.promoters,
      passives: breakdown.passives,
      detractors: breakdown.detractors,
      totalResponses: breakdown.totalResponses,
    },
  });

  return NextResponse.json({ id: snapshot.id, ...breakdown }, { status: 201 });
}
