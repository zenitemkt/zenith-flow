import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";
import { contentMediaPrefix } from "@/lib/content-media-server";
import { canSeeClient } from "@/lib/client-access";

interface RouteParams {
  params: { id: string };
}

/**
 * Guarda a chave da capa assim que ela sobe ao R2, antes do passo final de agendar — se esse
 * passo falhar ou a pessoa fechar a tela no meio, a capa não fica órfã no bucket sem registro.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, item.clientId))) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  if (!key.startsWith(contentMediaPrefix(item.agencyId, item.id))) return NextResponse.json({ error: "Chave inválida." }, { status: 400 });

  await prisma.contentItem.update({ where: { id: item.id }, data: { pendingCoverKey: key } });
  return NextResponse.json({ ok: true });
}
