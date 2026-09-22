import { Prisma, prisma, type RecurringTaskStatus, type RecurrenceMode } from "@zenite-mkt/db";
import { getOrCreateTaskProject } from "./task-projects";

export const RECURRING_TASK_STATUS_LABELS: Record<RecurringTaskStatus, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
};

export const RECURRENCE_MODE_LABELS: Record<RecurrenceMode, string> = {
  MENSAL: "Mensal",
  DATAS_ESPECIFICAS: "Datas específicas",
};

/** Período mensal no formato "AAAA-MM", usado como chave de idempotência quando recurrenceMode = MENSAL. */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Se um template ATIVO tem uma ocorrência vencida ainda não gerada — usado no banner da Home. */
export function hasPendingGeneration(template: {
  recurrenceMode: RecurrenceMode;
  dates: { date: Date }[];
  generations: { period: string }[];
}): boolean {
  const generatedPeriods = new Set(template.generations.map((g) => g.period));
  if (template.recurrenceMode === "MENSAL") {
    return !generatedPeriods.has(currentPeriod());
  }
  const todayKey = isoDateKey(new Date());
  return template.dates.some((d) => isoDateKey(d.date) <= todayKey && !generatedPeriods.has(isoDateKey(d.date)));
}

/** Aceita tanto "AAAA-MM" (mensal) quanto "AAAA-MM-DD" (datas específicas). */
export function formatPeriodLabel(period: string): string {
  const parts = period.split("-").map(Number);
  const [year = 0, month = 1, day] = parts;
  if (parts.length === 3) {
    return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface GenerateResult {
  status: "created" | "already_exists" | "not_active" | "nothing_due";
  taskId?: string;
  period?: string;
}

/**
 * Gera (idempotentemente) a próxima ocorrência devida de um template ativo —
 * uma Tarefa por período, não mais um Projeto+N tarefas (diferença do antigo
 * `generateRoutineRun`). A unicidade real é `@@unique([templateId, period])`
 * no banco; isso aqui só evita uma query desnecessária e trata a corrida.
 *
 * Modo MENSAL: período é sempre o mês corrente. Modo DATAS_ESPECIFICAS:
 * processa a ocorrência mais antiga já vencida (data <= hoje) que ainda não
 * foi gerada — clique de novo se houver mais de uma pendente, mesmo padrão
 * de gatilho manual de tudo que dependeria de `apps/worker`.
 */
export async function generateRecurringTaskRun(templateId: string, actorUserId: string): Promise<GenerateResult> {
  const template = await prisma.recurringTaskTemplate.findUnique({
    where: { id: templateId },
    include: {
      assignees: { orderBy: { order: "asc" } },
      checklistItems: { orderBy: { order: "asc" } },
      dates: { orderBy: { date: "asc" } },
    },
  });
  if (!template || template.status !== "ATIVO") {
    return { status: "not_active" };
  }

  let period: string;
  if (template.recurrenceMode === "MENSAL") {
    period = currentPeriod();
  } else {
    const todayKey = isoDateKey(new Date());
    const generated = await prisma.recurringTaskGeneration.findMany({
      where: { templateId },
      select: { period: true },
    });
    const generatedKeys = new Set(generated.map((g) => g.period));
    const due = template.dates.find((d) => isoDateKey(d.date) <= todayKey && !generatedKeys.has(isoDateKey(d.date)));
    if (!due) {
      return { status: "nothing_due" };
    }
    period = isoDateKey(due.date);
  }

  const existing = await prisma.recurringTaskGeneration.findUnique({
    where: { templateId_period: { templateId, period } },
  });
  if (existing) {
    return { status: "already_exists", taskId: existing.taskId ?? undefined, period };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await getOrCreateTaskProject(tx, template.agencyId, template.clientId);
      const task = await tx.task.create({
        data: {
          projectId: project.id,
          title: template.title,
          description: template.description,
          estimatedMinutes: template.estimatedMinutes,
          assigneeUserId: template.assignees[0]?.userId ?? null,
        },
      });
      await tx.taskStatusHistory.create({
        data: { taskId: task.id, toStatus: "BACKLOG", actorUserId },
      });
      if (template.assignees.length > 0) {
        await tx.taskAssignee.createMany({
          data: template.assignees.map((a) => ({ taskId: task.id, userId: a.userId, order: a.order })),
        });
      }
      if (template.checklistItems.length > 0) {
        await tx.taskChecklistItem.createMany({
          data: template.checklistItems.map((c) => ({ taskId: task.id, title: c.title, order: c.order })),
        });
      }
      const generation = await tx.recurringTaskGeneration.create({
        data: { templateId, period, taskId: task.id },
      });
      await tx.auditLog.create({
        data: {
          agencyId: template.agencyId,
          actorUserId,
          actorType: "user",
          action: "recurring_task.generated",
          resourceType: "recurring_task_generation",
          resourceId: generation.id,
          metadata: { period, taskId: task.id },
        },
      });
      return { taskId: task.id };
    });

    return { status: "created", period, ...result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raceWinner = await prisma.recurringTaskGeneration.findUnique({
        where: { templateId_period: { templateId, period } },
      });
      return { status: "already_exists", taskId: raceWinner?.taskId ?? undefined, period };
    }
    throw error;
  }
}
