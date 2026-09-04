import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/// Aloca este squad como responsável do cliente — encerra a alocação ativa
/// anterior (se houver, de qualquer squad) em vez de apagá-la, preservando o
/// histórico de handoff (seção 16 do manual).
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const squad = await prisma.squad.findUnique({ where: { id: params.id } });
  if (!squad || squad.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Squad não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const previous = await tx.clientAllocation.findFirst({
      where: { clientId, status: "ATIVA" },
    });
    if (previous) {
      if (previous.squadId === squad.id) return; // já é este squad — nada a fazer
      await tx.clientAllocation.update({
        where: { id: previous.id },
        data: { status: "ENCERRADA", endDate: new Date() },
      });
    }

    const allocation = await tx.clientAllocation.create({
      data: { clientId, squadId: squad.id },
    });

    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "client.squad_reassigned",
        resourceType: "client_allocation",
        resourceId: allocation.id,
        metadata: { clientId, squadId: squad.id, previousSquadId: previous?.squadId },
      },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
