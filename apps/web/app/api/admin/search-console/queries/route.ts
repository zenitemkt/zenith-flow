import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { resolveContentAutomationActor } from "@/lib/content-automation-auth";
import { decryptSecret } from "@/lib/crypto-secrets";
import { fetchRecentSearchQueries } from "@/lib/search-console";

/** Top pesquisas reais dos últimos N dias (padrão 7) — o agente usa isso pra priorizar o tema do artigo. */
export async function GET(request: Request) {
  const actor = await resolveContentAutomationActor(request);
  if (!actor) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const connection = await prisma.searchConsoleConnection.findUnique({ where: { agencyId: actor.agencyId } });
  if (!connection) return NextResponse.json({ connected: false, queries: [] });

  const days = Number(new URL(request.url).searchParams.get("days") ?? "7") || 7;

  try {
    const queries = await fetchRecentSearchQueries(decryptSecret(connection.refreshTokenEnc), connection.siteUrl, days);
    await prisma.searchConsoleConnection.update({ where: { id: connection.id }, data: { lastValidatedAt: new Date(), lastError: null } });
    return NextResponse.json({ connected: true, siteUrl: connection.siteUrl, queries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.searchConsoleConnection.update({ where: { id: connection.id }, data: { lastError: message } });
    return NextResponse.json({ error: "Falha ao consultar o Search Console.", details: message }, { status: 502 });
  }
}
