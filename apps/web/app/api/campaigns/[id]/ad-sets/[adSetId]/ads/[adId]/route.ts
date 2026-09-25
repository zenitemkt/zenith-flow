import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; adSetId: string; adId: string };
}

async function loadAd(campaignId: string, adSetId: string, adId: string, agencyId: string) {
  const ad = await prisma.ad.findUnique({ where: { id: adId }, include: { adSet: { include: { campaign: true } } } });
  if (!ad || ad.adSetId !== adSetId || ad.adSet.campaignId !== campaignId || ad.adSet.campaign.agencyId !== agencyId) {
    return null;
  }
  return ad;
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

  const ad = await loadAd(params.id, params.adSetId, params.adId, membership.agencyId);
  if (!ad) {
    return NextResponse.json({ error: "Anúncio não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Informe o nome do anúncio." }, { status: 400 });
  }
  const creativeNote = typeof body?.creativeNote === "string" ? body.creativeNote.trim() || null : null;
  const assetUrl = typeof body?.assetUrl === "string" ? body.assetUrl.trim() || null : null;
  const active = body?.active === undefined ? ad.active : Boolean(body.active);

  await prisma.ad.update({ where: { id: ad.id }, data: { name, creativeNote, assetUrl, active } });

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

  const ad = await loadAd(params.id, params.adSetId, params.adId, membership.agencyId);
  if (!ad) {
    return NextResponse.json({ error: "Anúncio não encontrado." }, { status: 404 });
  }

  await prisma.ad.delete({ where: { id: ad.id } });

  return NextResponse.json({ ok: true });
}
