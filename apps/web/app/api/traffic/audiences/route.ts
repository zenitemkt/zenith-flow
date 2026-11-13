import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto-secrets";
import { listCustomAudiences } from "@/lib/meta-marketing";

/** Públicos personalizados da conta (remarketing dos conjuntos [QUENTE]). */
export async function GET() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const ads = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } } });
  if (!ads) return NextResponse.json({ error: "Conta de anúncios da Meta não conectada." }, { status: 400 });
  try {
    return NextResponse.json({ audiences: await listCustomAudiences(decryptSecret(ads.accessTokenEnc), ads.externalAccountId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui listar os públicos." }, { status: 502 });
  }
}
