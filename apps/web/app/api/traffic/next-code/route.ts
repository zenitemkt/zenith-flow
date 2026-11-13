import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto-secrets";
import { OBJECTIVE_CODES, nextCampaignNumberInfo } from "@/lib/campaign-naming";

/** Próximo código de campanha (ex.: LEAD03) para mostrar na tela antes de subir. */
export async function GET(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const objective = new URL(request.url).searchParams.get("objective") ?? "OUTCOME_LEADS";
  const code = OBJECTIVE_CODES[objective as keyof typeof OBJECTIVE_CODES];
  if (!code) return NextResponse.json({ error: "Objetivo inválido." }, { status: 400 });
  const ads = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId: membership.agencyId, platform: "META" } } });
  if (!ads) return NextResponse.json({ error: "Conta de anúncios da Meta não conectada." }, { status: 400 });
  try {
    const info = await nextCampaignNumberInfo(decryptSecret(ads.accessTokenEnc), ads.externalAccountId, code);
    return NextResponse.json({ code: `${code}${String(info.next).padStart(2, "0")}`, last: info.last });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui ler as campanhas." }, { status: 502 });
  }
}
