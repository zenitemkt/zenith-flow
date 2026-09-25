import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Adiciona um ponto de segmentação geográfica pro "Mapa do Tráfego" (pedido do Kevin, 2026-09-25). */
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
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) {
    return NextResponse.json({ error: "Informe um nome (ex.: nome da cidade)." }, { status: 400 });
  }
  const lat = parseCoordinate(body?.lat, -90, 90);
  const lng = parseCoordinate(body?.lng, -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json({ error: "Latitude/longitude inválidas." }, { status: 400 });
  }
  let radiusKm: number | null = null;
  if (body?.radiusKm !== null && body?.radiusKm !== undefined && body?.radiusKm !== "") {
    const parsed = Number(body.radiusKm);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Raio inválido." }, { status: 400 });
    }
    radiusKm = parsed;
  }

  const geoTarget = await prisma.campaignGeoTarget.create({
    data: { campaignId: campaign.id, label, lat, lng, radiusKm },
  });

  return NextResponse.json({ id: geoTarget.id }, { status: 201 });
}
