import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { encryptSecret } from "@/lib/crypto-secrets";
import { exchangeSearchConsoleCode, listSearchConsoleSites } from "@/lib/search-console";
import { verifyOAuthState } from "@/lib/oauth-state";

function redirectToBlogAutomation(request: Request, params: Record<string, string>) {
  const url = new URL("/automacoes/blog", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/**
 * Callback do OAuth do Search Console — redireciona de volta pra
 * /automacoes/blog com `?gsc=connected|error` (navegação do navegador, nunca
 * server-to-server, mesmo padrão do callback da Meta).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) return redirectToBlogAutomation(request, { gsc: "error", reason: "authorization_denied" });

  const verified = verifyOAuthState(state);
  if (!verified) return redirectToBlogAutomation(request, { gsc: "error", reason: "invalid_state" });
  if (!code) return redirectToBlogAutomation(request, { gsc: "error", reason: "missing_code" });

  const membership = await prisma.membership.findFirst({
    where: { agencyId: verified.agencyId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return redirectToBlogAutomation(request, { gsc: "error", reason: "agency_not_found" });

  try {
    const tokens = await exchangeSearchConsoleCode(code);
    if (!tokens.refresh_token) {
      // Sem prompt=consent numa autorização repetida o Google às vezes omite — já mandamos
      // prompt=consent no /start, então isso só deveria acontecer num cenário incomum.
      return redirectToBlogAutomation(request, { gsc: "error", reason: "no_refresh_token" });
    }

    const sites = await listSearchConsoleSites(tokens.access_token);
    const match = sites.find((site) => site.siteUrl.includes("hubzenite.com.br"));
    if (!match) return redirectToBlogAutomation(request, { gsc: "error", reason: "site_not_found" });

    await prisma.searchConsoleConnection.upsert({
      where: { agencyId: verified.agencyId },
      create: {
        agencyId: verified.agencyId,
        siteUrl: match.siteUrl,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        connectedByUserId: membership.userId,
        lastValidatedAt: new Date(),
      },
      update: {
        siteUrl: match.siteUrl,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        connectedByUserId: membership.userId,
        lastValidatedAt: new Date(),
        lastError: null,
      },
    });

    return redirectToBlogAutomation(request, { gsc: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.auditLog.create({
      data: {
        agencyId: verified.agencyId,
        actorType: "user",
        action: "integration.connect_failed",
        resourceType: "search_console_connection",
        metadata: { error: message },
      },
    });
    return redirectToBlogAutomation(request, { gsc: "error", reason: "google_api_error" });
  }
}
