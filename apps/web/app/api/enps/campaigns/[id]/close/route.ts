import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canViewEnps } from "@/lib/rbac";
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
  if (!canViewEnps(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const campaign = await prisma.enpsCampaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }
  if (campaign.status !== "ENVIADA") {
    return NextResponse.json({ error: "Só é possível encerrar uma pesquisa já enviada." }, { status: 400 });
  }

  await prisma.enpsCampaign.update({
    where: { id: campaign.id },
    data: { status: "ENCERRADA", closedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
