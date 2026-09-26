import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  if (!name) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      name,
      document: optionalString(body?.document),
      email: optionalString(body?.email),
      phone: optionalString(body?.phone),
      whatsapp: optionalString(body?.whatsapp),
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "client.updated",
      resourceType: "client",
      resourceId: client.id,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir clientes." }, { status: 403 });
  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, name: true, workspaceId: true } });
  if (!client || client.agencyId !== membership.agencyId) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.client.delete({ where: { id: client.id } });
    if (client.workspaceId) await tx.workspace.deleteMany({ where: { id: client.workspaceId, agencyId: membership.agencyId, kind: "CLIENT" } });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "client.deleted", resourceType: "client", resourceId: client.id, metadata: { name: client.name, portalWorkspaceRemoved: Boolean(client.workspaceId) } } });
  });
  return NextResponse.json({ ok: true });
}
