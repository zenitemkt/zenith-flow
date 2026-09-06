import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { getOrCreateTaskProject } from "@/lib/task-projects";
import { prisma } from "@zenith/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Solicitação aberta pelo próprio cliente no portal — com o Kanban unificado
 * de Operação (ver docs/DECISIONS.md, 2026-09-06), isso agora cria uma
 * Tarefa sem responsável (`assigneeUserId: null`, sem `TaskAssignee`), que
 * cai na coluna compartilhada "Não atribuída" pra equipe assumir. O cliente
 * nunca escolhe cliente (vem do workspace da sessão) nem responsável.
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito ao portal do cliente." }, { status: 403 });
  }

  const client = await prisma.client.findUnique({ where: { workspaceId: membership.workspaceId } });
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const title = optionalString(body?.title);
  if (!title) {
    return NextResponse.json({ error: "Informe um título para a solicitação." }, { status: 400 });
  }
  const description = optionalString(body?.description);

  const task = await prisma.$transaction(async (tx) => {
    const project = await getOrCreateTaskProject(tx, client.agencyId, client.id);
    const created = await tx.task.create({
      data: { projectId: project.id, title, description },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: created.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: client.agencyId,
        actorUserId: session.user.id,
        actorType: "client_portal",
        action: "task.created",
        resourceType: "task",
        resourceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: task.id }, { status: 201 });
}
