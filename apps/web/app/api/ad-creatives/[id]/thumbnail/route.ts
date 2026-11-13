import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { fetchDriveThumbnail } from "@/lib/google-drive";

/** Miniatura do criativo, buscada no Drive com a credencial do sistema (o navegador não tem acesso direto). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const creative = await prisma.adCreative.findFirst({ where: { id: params.id, agencyId: membership.agencyId }, select: { driveFileId: true } });
  if (!creative) return NextResponse.json({ error: "Criativo não encontrado." }, { status: 404 });
  const thumb = await fetchDriveThumbnail(creative.driveFileId).catch(() => null);
  if (!thumb) return new NextResponse(null, { status: 404 });
  return new NextResponse(thumb.body, { headers: { "Content-Type": thumb.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=3600" } });
}
