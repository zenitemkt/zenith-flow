import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { createOAuthState } from "@/lib/oauth-state";
import { buildMetaSocialAuthorizeUrl } from "@/lib/meta-social";

/** "Conectar Facebook/Instagram" no perfil do cliente — leva pro diálogo de autorização da Meta. */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const clientId = new URL(request.url).searchParams.get("clientId") ?? "";
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const state = createOAuthState(membership.agencyId, { flow: "social", clientId: client.id, userId: session.user.id });
  return NextResponse.redirect(buildMetaSocialAuthorizeUrl(state));
}
