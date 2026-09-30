import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { encryptSecret } from "@/lib/crypto-secrets";
import { exchangeMetaCodeForShortLivedToken, exchangeMetaTokenForLongLived, fetchMetaAdAccounts, META_OAUTH_SCOPES } from "@/lib/meta-ads";
import { verifyOAuthState } from "@/lib/oauth-state";

function redirectToTracking(request: Request, params: Record<string, string>) {
  const url = new URL("/traqueamento/conexoes", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

/**
 * Callback do OAuth da Meta (seção 38) — chamado pelo navegador do usuário
 * depois de autorizar (ou cancelar) no diálogo da Meta, nunca por chamada
 * server-to-server. Por isso toda saída é um redirect de volta pra
 * `/traqueamento/conexoes` com um parâmetro de resultado (`?meta=connected|error`),
 * nunca um JSON de erro puro — quem está do outro lado é uma navegação, não
 * um `fetch`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const metaError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (metaError) {
    return redirectToTracking(request, { meta: "error", reason: "authorization_denied" });
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return redirectToTracking(request, { meta: "error", reason: "invalid_state" });
  }
  if (!code) {
    return redirectToTracking(request, { meta: "error", reason: "missing_code" });
  }

  const membership = await prisma.membership.findFirst({
    where: { agencyId: verified.agencyId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return redirectToTracking(request, { meta: "error", reason: "agency_not_found" });
  }

  try {
    const shortLived = await exchangeMetaCodeForShortLivedToken(code);
    const longLived = await exchangeMetaTokenForLongLived(shortLived.access_token);
    const adAccounts = await fetchMetaAdAccounts(longLived.access_token);

    if (adAccounts.length === 0) {
      return redirectToTracking(request, { meta: "error", reason: "no_ad_account" });
    }
    // Simplificação desta fatia: uma conexão por agência (ver schema.prisma) — usa a primeira conta
    // retornada. Escolher entre várias fica pra quando aparecer caso real de agência com mais de uma.
    const account = adAccounts[0]!;

    const tokenExpiresAt = longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null;

    await prisma.$transaction([
      prisma.adAccountConnection.upsert({
        where: { agencyId_platform: { agencyId: verified.agencyId, platform: "META" } },
        create: {
          agencyId: verified.agencyId,
          platform: "META",
          externalAccountId: account.id,
          externalAccountName: account.name,
          accessTokenEnc: encryptSecret(longLived.access_token),
          tokenExpiresAt,
          scopes: [...META_OAUTH_SCOPES],
          status: "ACTIVE",
          lastValidatedAt: new Date(),
          connectedByUserId: membership.userId,
        },
        update: {
          externalAccountId: account.id,
          externalAccountName: account.name,
          accessTokenEnc: encryptSecret(longLived.access_token),
          tokenExpiresAt,
          scopes: [...META_OAUTH_SCOPES],
          status: "ACTIVE",
          lastError: null,
          lastValidatedAt: new Date(),
          connectedByUserId: membership.userId,
        },
      }),
      prisma.auditLog.create({
        data: {
          agencyId: verified.agencyId,
          actorUserId: membership.userId,
          actorType: "user",
          action: "integration.connected",
          resourceType: "ad_account_connection",
          resourceId: account.id,
          metadata: { platform: "META", accountName: account.name },
        },
      }),
    ]);

    return redirectToTracking(request, { meta: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await prisma.auditLog.create({
      data: {
        agencyId: verified.agencyId,
        actorType: "user",
        action: "integration.connect_failed",
        resourceType: "ad_account_connection",
        metadata: { platform: "META", error: message },
      },
    });
    return redirectToTracking(request, { meta: "error", reason: "meta_api_error" });
  }
}
