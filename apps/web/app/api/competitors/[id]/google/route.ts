import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { linkGooglePlace, syncGooglePlace } from "@/lib/google-places";

async function load(id: string) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || isClientRole(membership.role)) return null;
  const competitor = await prisma.competitor.findFirst({ where: { id, agencyId: membership.agencyId }, select: { id: true, clientId: true } });
  return competitor && await canSeeClient(membership.agencyId, session.user.id, competitor.clientId) ? competitor : null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const competitor = await load(params.id);
  if (!competitor) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  const body = await request.json().catch(() => null);
  try {
    const place = body?.placeId ? await linkGooglePlace(competitor.id, String(body.placeId)) : await syncGooglePlace(competitor.id);
    return NextResponse.json({ ok: true, place });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar." }, { status: 502 }); }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const competitor = await load(params.id);
  if (!competitor) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  await prisma.$transaction([
    prisma.competitorGoogleSnapshot.deleteMany({ where: { competitorId: competitor.id } }),
    prisma.competitor.update({ where: { id: competitor.id }, data: { googlePlaceId: null, googlePlaceName: null, googlePlaceAddress: null, googleRating: null, googleReviewCount: null, googleLastSyncAt: null, googleLastError: null } }),
  ]);
  return NextResponse.json({ ok: true });
}
