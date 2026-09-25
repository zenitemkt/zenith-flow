import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; adSetId: string };
}

/** Cria um anúncio dentro de um conjunto, pro "Tráfego - Raio X" (seção 36). */
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

  const adSet = await prisma.adSet.findUnique({ where: { id: params.adSetId }, include: { campaign: true } });
  if (!adSet || adSet.campaignId !== params.id || adSet.campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conjunto de anúncios não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Informe o nome do anúncio." }, { status: 400 });
  }
  const creativeNote = typeof body?.creativeNote === "string" ? body.creativeNote.trim() || null : null;
  const assetUrl = typeof body?.assetUrl === "string" ? body.assetUrl.trim() || null : null;

  const ad = await prisma.ad.create({
    data: { adSetId: adSet.id, name, creativeNote, assetUrl },
  });

  return NextResponse.json({ id: ad.id }, { status: 201 });
}
