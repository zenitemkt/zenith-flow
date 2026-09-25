import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { reaisToCents } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Cria um conjunto de anúncios pra navegar dentro do "Tráfego - Raio X" (seção 36). */
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

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Informe o nome do conjunto de anúncios." }, { status: 400 });
  }
  const targetingSummary = typeof body?.targetingSummary === "string" ? body.targetingSummary.trim() || null : null;
  const budgetCents =
    body?.budget === null || body?.budget === undefined || body?.budget === "" ? null : reaisToCents(Number(body.budget));
  if (budgetCents !== null && !Number.isFinite(budgetCents)) {
    return NextResponse.json({ error: "Orçamento inválido." }, { status: 400 });
  }

  const adSet = await prisma.adSet.create({
    data: { campaignId: campaign.id, name, targetingSummary, budgetCents },
  });

  return NextResponse.json({ id: adSet.id }, { status: 201 });
}
