import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { hashCompetitorAdsToken, parseCompetitorAdsPayload, syncCompetitorAds } from "@/lib/competitor-ads";

export const maxDuration = 60;

function bearer(request: Request): string | null {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const token = bearer(request);
  if (!token || token.length > 200) return NextResponse.json({ error: "Token ausente." }, { status: 401 });
  const agency = await prisma.agency.findUnique({ where: { competitorAdsTokenHash: hashCompetitorAdsToken(token) }, select: { id: true } });
  if (!agency) return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  try {
    const ads = parseCompetitorAdsPayload(await request.json().catch(() => null));
    return NextResponse.json(await syncCompetitorAds(params.id, agency.id, ads));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível importar os anúncios.";
    const status = /não encontrado/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

