import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { calendarRedirectUri, googleClient } from "@/lib/assistant/calendar";

/** Conecta a conta Google que tem acesso de edição às agendas dos sócios. */
export async function GET() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership || !canManageIntegrations(membership.role)) return NextResponse.redirect(new URL("/login", calendarRedirectUri()));
  const state = randomBytes(16).toString("hex");
  cookies().set("assistant_gcal_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", googleClient().id);
  url.searchParams.set("redirect_uri", calendarRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar openid email");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
