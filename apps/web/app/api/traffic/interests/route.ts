import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto-secrets";
import { searchInterests } from "@/lib/meta-marketing";

/** Busca de interesses da Meta para o público dos conjuntos. */
export async function GET(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ interests: [] });
  const ads = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } } });
  if (!ads) return NextResponse.json({ error: "Conta de anúncios da Meta não conectada." }, { status: 400 });
  try {
    return NextResponse.json({ interests: await searchInterests(decryptSecret(ads.accessTokenEnc), q) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Busca falhou." }, { status: 502 });
  }
}
