import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

/**
 * Renomear ou desativar/reativar um sócio. Não há exclusão: o sócio pode já
 * ter valores no histórico. Desativado some das opções de novos lançamentos,
 * mas continua aparecendo no que já foi lançado.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem alterar sócios." }, { status: 403 });
  }
  const partner = await prisma.financePartner.findUnique({ where: { id: params.id } });
  if (!partner || partner.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Sócio não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : partner.name;
  const active = typeof body?.active === "boolean" ? body.active : partner.active;
  if (!name || name.length > 60) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
  if (name !== partner.name) {
    const clash = await prisma.financePartner.findFirst({
      where: { agencyId: membership.agencyId, id: { not: partner.id }, name: { equals: name, mode: "insensitive" } },
    });
    if (clash) return NextResponse.json({ error: "Já existe um sócio com esse nome." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.financePartner.update({ where: { id: partner.id }, data: { name, active } }),
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "finance_partner.updated",
        resourceType: "finance_partner",
        resourceId: partner.id,
        metadata: { from: { name: partner.name, active: partner.active }, to: { name, active } },
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
