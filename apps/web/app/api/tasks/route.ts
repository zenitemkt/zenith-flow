import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { getOrCreateTaskProject } from "@/lib/task-projects";
import { prisma } from "@zenite-mkt/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Criação de tarefa do Kanban unificado de Operação (ver docs/DECISIONS.md,
 * 2026-09-06). `clientId` resolve/cria o projeto invisível por trás
 * (`getOrCreateTaskProject`) — quem cria a tarefa nunca escolhe um projeto.
 * `assigneeUserIds` vira a fila sequencial (`TaskAssignee`, ordem = ordem do
 * array); vazio é aceito só quando a tarefa nasce sem responsável (hoje,
 * exclusivamente o Portal do Cliente — `/api/portal/requests`).
 */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const title = optionalString(body?.title);
  if (!title) {
    return NextResponse.json({ error: "Informe o título da tarefa." }, { status: 400 });
  }
  const description = optionalString(body?.description);
  const clientId = optionalString(body?.clientId);
  const blockedByTaskId = optionalString(body?.blockedByTaskId);

  const dueDateRaw = optionalString(body?.dueDate);
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Prazo inválido." }, { status: 400 });
  }

  const estimatedMinutesRaw = body?.estimatedMinutes;
  const estimatedMinutes =
    estimatedMinutesRaw === null || estimatedMinutesRaw === undefined || estimatedMinutesRaw === ""
      ? null
      : Number(estimatedMinutesRaw);
  if (estimatedMinutes !== null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
    return NextResponse.json({ error: "Duração estimada inválida." }, { status: 400 });
  }

  const checklist: string[] = Array.isArray(body?.checklist)
    ? body.checklist
        .filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item: string) => item.trim())
    : [];

  const assigneeUserIds: string[] = Array.isArray(body?.assigneeUserIds)
    ? Array.from(
        new Set(
          body.assigneeUserIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
        ),
      )
    : [];

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
  }

  if (assigneeUserIds.length > 0) {
    const validMemberships = await prisma.membership.findMany({
      where: {
        userId: { in: assigneeUserIds },
        agencyId: membership.agencyId,
        status: "ACTIVE",
        workspace: { kind: "AGENCY" },
      },
      select: { userId: true },
    });
    const validUserIds = new Set(validMemberships.map((m) => m.userId));
    if (assigneeUserIds.some((id) => !validUserIds.has(id))) {
      return NextResponse.json(
        { error: "Um ou mais responsáveis são inválidos para esta agência." },
        { status: 400 },
      );
    }
  }

  if (blockedByTaskId) {
    const blocker = await prisma.task.findUnique({
      where: { id: blockedByTaskId },
      include: { project: { select: { agencyId: true, clientId: true } } },
    });
    if (!blocker || blocker.project.agencyId !== membership.agencyId || blocker.project.clientId !== clientId) {
      return NextResponse.json({ error: "Tarefa bloqueadora inválida." }, { status: 400 });
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const project = await getOrCreateTaskProject(tx, membership.agencyId, clientId);

    const created = await tx.task.create({
      data: {
        projectId: project.id,
        title,
        description,
        blockedByTaskId,
        dueDate,
        estimatedMinutes,
        assigneeUserId: assigneeUserIds[0] ?? null,
      },
    });
    await tx.taskStatusHistory.create({
      data: { taskId: created.id, toStatus: "BACKLOG", actorUserId: session.user.id },
    });
    if (assigneeUserIds.length > 0) {
      await tx.taskAssignee.createMany({
        data: assigneeUserIds.map((userId, index) => ({ taskId: created.id, userId, order: index })),
      });
    }
    if (checklist.length > 0) {
      await tx.taskChecklistItem.createMany({
        data: checklist.map((itemTitle, index) => ({ taskId: created.id, title: itemTitle, order: index })),
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "task.created",
        resourceType: "task",
        resourceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: task.id }, { status: 201 });
}
