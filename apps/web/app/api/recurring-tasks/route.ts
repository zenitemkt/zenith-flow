import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type RecurrenceMode } from "@zenite-mkt/db";
import { generateRecurringTaskRun } from "@/lib/recurring-tasks";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Criação de uma recorrência a partir do toggle "Tarefa recorrente" no popup
 * de nova tarefa (Kanban unificado de Operação, ver docs/DECISIONS.md). Nasce
 * já ATIVA — sem passo de rascunho, já que é configurada de uma vez só no
 * mesmo formulário. Gera a primeira ocorrência na hora (mesma UX de já ver a
 * tarefa aparecer no board depois de criar a recorrência).
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
  const recurrenceMode = body?.recurrenceMode === "DATAS_ESPECIFICAS" ? "DATAS_ESPECIFICAS" : "MENSAL";

  const estimatedMinutesRaw = body?.estimatedMinutes;
  const estimatedMinutes =
    estimatedMinutesRaw === null || estimatedMinutesRaw === undefined || estimatedMinutesRaw === ""
      ? null
      : Number(estimatedMinutesRaw);
  if (estimatedMinutes !== null && (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 0)) {
    return NextResponse.json({ error: "Duração estimada inválida." }, { status: 400 });
  }

  let dayOfMonth: number | null = null;
  let dates: Date[] = [];
  if (recurrenceMode === "MENSAL") {
    dayOfMonth = Number(body?.dayOfMonth);
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return NextResponse.json({ error: "Escolha um dia do mês entre 1 e 28." }, { status: 400 });
    }
  } else {
    const rawDates: unknown[] = Array.isArray(body?.dates) ? body.dates : [];
    dates = rawDates
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));
    if (dates.length === 0) {
      return NextResponse.json({ error: "Escolha pelo menos uma data no calendário." }, { status: 400 });
    }
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

  const template = await prisma.recurringTaskTemplate.create({
    data: {
      agencyId: membership.agencyId,
      clientId,
      title,
      description,
      estimatedMinutes,
      recurrenceMode: recurrenceMode as RecurrenceMode,
      dayOfMonth,
      status: "ATIVO",
      assignees: { create: assigneeUserIds.map((userId, index) => ({ userId, order: index })) },
      checklistItems: { create: checklist.map((itemTitle, index) => ({ title: itemTitle, order: index })) },
      dates: { create: dates.map((date) => ({ date })) },
    },
  });

  const generation = await generateRecurringTaskRun(template.id, session.user.id);

  return NextResponse.json({ id: template.id, taskId: generation.taskId }, { status: 201 });
}
