import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { reaisToCents } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; adSetId: string };
}

async function loadAdSet(campaignId: string, adSetId: string, agencyId: string) {
  const adSet = await prisma.adSet.findUnique({ where: { id: adSetId }, include: { campaign: true } });
  if (!adSet || adSet.campaignId !== campaignId || adSet.campaign.agencyId !== agencyId) return null;
  return adSet;
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const adSet = await loadAdSet(params.id, params.adSetId, membership.agencyId);
  if (!adSet) {
    return NextResponse.json({ error: "Conjunto de anúncios não encontrado." }, { status: 404 });
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
  const active = body?.active === undefined ? adSet.active : Boolean(body.active);

  await prisma.adSet.update({ where: { id: adSet.id }, data: { name, targetingSummary, budgetCents, active } });

  return NextResponse.json({ ok: true });
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

  const adSet = await loadAdSet(params.id, params.adSetId, membership.agencyId);
  if (!adSet) {
    return NextResponse.json({ error: "Conjunto de anúncios não encontrado." }, { status: 404 });
  }

  await prisma.adSet.delete({ where: { id: adSet.id } });

  return NextResponse.json({ ok: true });
}
