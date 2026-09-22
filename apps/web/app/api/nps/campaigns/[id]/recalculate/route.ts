import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { computeNpsBreakdown } from "@/lib/nps";
import { prisma } from "@zenite-mkt/db";

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
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const campaign = await prisma.surveyCampaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }

  const responded = await prisma.surveyRecipient.findMany({
    where: { campaignId: campaign.id, status: "RESPONDIDO" },
    select: { score: true },
  });
  const scores = responded.map((r) => r.score).filter((s): s is number => s !== null);
  const breakdown = computeNpsBreakdown(scores);

  const snapshot = await prisma.npsSnapshot.create({
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
