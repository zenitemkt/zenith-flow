import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

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

  const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!vendor || vendor.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
  }
  if (vendor.status === "BLOQUEADO") {
    return NextResponse.json(
      { error: "Fornecedor bloqueado — não é possível abrir nova ordem." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const taskId = typeof body?.taskId === "string" && body.taskId ? body.taskId : null;

  if (!description) {
    return NextResponse.json({ error: "Descreva o que está sendo pedido." }, { status: 400 });
  }

  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
    if (!task || task.project.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
    }
  }

  const order = await prisma.vendorOrder.create({
    data: { vendorId: vendor.id, taskId, description },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "vendor_order.created",
      resourceType: "vendor_order",
      resourceId: order.id,
      metadata: { vendorId: vendor.id, taskId },
    },
  });

  return NextResponse.json({ id: order.id }, { status: 201 });
}
