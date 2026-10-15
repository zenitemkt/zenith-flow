import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { buildSearchConsoleAuthorizeUrl } from "@/lib/search-console";
import { createOAuthState } from "@/lib/oauth-state";

/** Início do fluxo "Conectar Search Console" — redireciona pro diálogo de autorização do Google. */
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const state = createOAuthState(membership.agencyId);
  return NextResponse.redirect(buildSearchConsoleAuthorizeUrl(state));
}
