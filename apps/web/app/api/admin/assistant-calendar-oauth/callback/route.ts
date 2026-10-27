import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto-secrets";
import { calendarRedirectUri, googleClient } from "@/lib/assistant/calendar";
import { DEFAULT_ASSISTANT_CONFIG } from "@/lib/assistant/config";

export async function GET(request: Request) {
  const back = (status: string) => NextResponse.redirect(new URL(`/automacoes/assistente?calendar=${status}`, calendarRedirectUri()));
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return back("erro");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== cookies().get("assistant_gcal_state")?.value) return back("erro");

  const { id, secret } = googleClient();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: calendarRedirectUri(), grant_type: "authorization_code" }),
  });
  const token = await response.json();
  if (!response.ok || !token.refresh_token) return back("erro");
  const email = token.id_token ? JSON.parse(Buffer.from(String(token.id_token).split(".")[1] ?? "", "base64url").toString()).email ?? null : null;

  await prisma.assistantSettings.upsert({
    where: { agencyId: membership.agencyId },
    create: { agencyId: membership.agencyId, config: DEFAULT_ASSISTANT_CONFIG as object, googleRefreshTokenEnc: encryptSecret(token.refresh_token), googleAccountEmail: email },
    update: { googleRefreshTokenEnc: encryptSecret(token.refresh_token), googleAccountEmail: email },
  });
  return back("ok");
}
