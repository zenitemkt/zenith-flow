import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { exchangeMetaCodeForShortLivedToken, exchangeMetaTokenForLongLived } from "@/lib/meta-ads";
import {
  SOCIAL_OAUTH_PENDING_COOKIE,
  SOCIAL_OAUTH_PENDING_TTL_SECONDS,
  encodeSocialOAuthPending,
} from "@/lib/social-oauth-pending";

/**
 * Retorno do OAuth da Meta quando o fluxo é "social" (agendador). Chamado
 * pela rota de callback compartilhada com Ads. Sempre termina num redirect
 * pro perfil do cliente com `?social=...`.
 */
export async function handleSocialOAuthCallback(
  request: Request,
  input: { agencyId: string; clientId: string; userId: string; code: string | null; denied: boolean },
): Promise<NextResponse> {
  const back = (params: Record<string, string>) => {
    const url = new URL(`/clientes/${input.clientId}`, request.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
  };

  if (input.denied) return back({ social: "error", reason: "authorization_denied" });
  if (!input.code) return back({ social: "error", reason: "missing_code" });

  const client = await prisma.client.findUnique({ where: { id: input.clientId }, select: { agencyId: true } });
  if (!client || client.agencyId !== input.agencyId) return back({ social: "error", reason: "client_not_found" });

  try {
    const shortLived = await exchangeMetaCodeForShortLivedToken(input.code);
    const longLived = await exchangeMetaTokenForLongLived(shortLived.access_token);
    const response = back({ social: "choose" });
    response.cookies.set(
      SOCIAL_OAUTH_PENDING_COOKIE,
      encodeSocialOAuthPending({
        agencyId: input.agencyId,
        clientId: input.clientId,
        userId: input.userId,
        userAccessToken: longLived.access_token,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SOCIAL_OAUTH_PENDING_TTL_SECONDS,
      },
    );
    return response;
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        agencyId: input.agencyId,
        actorUserId: input.userId,
        actorType: "user",
        action: "social.connect_failed",
        resourceType: "client",
        resourceId: input.clientId,
        metadata: { error: error instanceof Error ? error.message : "Erro desconhecido." },
      },
    });
    return back({ social: "error", reason: "meta_api_error" });
  }
}
