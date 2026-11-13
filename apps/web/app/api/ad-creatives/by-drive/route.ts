import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";

/** Criativos da biblioteca pelos IDs de arquivo do Drive (usado logo depois do envio pela etapa Anúncios). */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.driveFileIds) ? body.driveFileIds.filter((x: unknown): x is string => typeof x === "string").slice(0, 50) : [];
  const rows = await prisma.adCreative.findMany({
    where: { agencyId: membership.agencyId, driveFileId: { in: ids } },
    select: { id: true, name: true, fileName: true, kind: true, status: true, primaryText: true, headline: true, description: true, linkUrl: true, callToAction: true },
  });
  return NextResponse.json({ creatives: rows });
}
