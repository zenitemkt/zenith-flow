import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { verifyOAuthState } from "@/lib/oauth-state";
import { encryptSecret } from "@/lib/crypto-secrets";
import { exchangeGoogleBusinessCode, fetchGoogleAccountEmail, GOOGLE_BUSINESS_SCOPES } from "@/lib/google-business";

function back(request: Request, result: string) { return NextResponse.redirect(new URL(`/integracoes?googleBusiness=${result}`, request.url)); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return back(request, "denied");
  const state = verifyOAuthState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!state || state.extra.flow !== "google-business" || !code) return back(request, "invalid_state");
  try {
    const tokens = await exchangeGoogleBusinessCode(code);
    if (!tokens.refresh_token) return back(request, "missing_refresh_token");
    const email = await fetchGoogleAccountEmail(tokens.access_token);
    await prisma.$transaction([
      prisma.googleBusinessConnection.upsert({
        where: { agencyId: state.agencyId },
        create: { agencyId: state.agencyId, googleAccountEmail: email, refreshTokenEnc: encryptSecret(tokens.refresh_token), scopes: tokens.scope?.split(" ") ?? [...GOOGLE_BUSINESS_SCOPES], status: "ACTIVE", lastValidatedAt: new Date(), connectedByUserId: state.extra.userId },
        update: { googleAccountEmail: email, refreshTokenEnc: encryptSecret(tokens.refresh_token), scopes: tokens.scope?.split(" ") ?? [...GOOGLE_BUSINESS_SCOPES], status: "ACTIVE", lastValidatedAt: new Date(), lastError: null, connectedByUserId: state.extra.userId },
      }),
      prisma.auditLog.create({ data: { agencyId: state.agencyId, actorUserId: state.extra.userId, actorType: "user", action: "integration.connected", resourceType: "google_business_connection", metadata: { accountEmail: email } } }),
    ]);
    return back(request, "connected");
  } catch (error) {
    await prisma.auditLog.create({ data: { agencyId: state.agencyId, actorUserId: state.extra.userId, actorType: "user", action: "integration.connect_failed", resourceType: "google_business_connection", metadata: { error: error instanceof Error ? error.message : "unknown" } } });
    return back(request, "error");
  }
}
