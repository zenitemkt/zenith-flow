import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { createOAuthState } from "@/lib/oauth-state";
import { buildGoogleBusinessAuthorizeUrl, googleBusinessConfigured } from "@/lib/google-business";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) return NextResponse.redirect(new URL("/integracoes?googleBusiness=forbidden", request.url));
  if (!googleBusinessConfigured()) return NextResponse.redirect(new URL("/integracoes?googleBusiness=not_configured", request.url));
  const state = createOAuthState(membership.agencyId, { flow: "google-business", userId: session.user.id });
  return NextResponse.redirect(buildGoogleBusinessAuthorizeUrl(state));
}
