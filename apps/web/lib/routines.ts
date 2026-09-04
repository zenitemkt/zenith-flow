import { Prisma, prisma, type RoutineStatus, type RoutineRunStatus } from "@zenith/db";

export const ROUTINE_STATUS_LABELS: Record<RoutineStatus, string> = {
  RASCUNHO: "Rascunho",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ARQUIVADO: "Arquivado",
};

export const ROUTINE_RUN_STATUS_LABELS: Record<RoutineRunStatus, string> = {
  AGENDADA: "Agendada",
  CRIADA: "Criada",
  IGNORADA: "Ignorada",
  FALHOU: "Falhou",
};

/** Período mensal no formato "AAAA-MM", usado como chave de idempotência. */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface GenerateResult {
  status: "created" | "already_exists" | "not_active";
  runId?: string;
  projectId?: string;
}

/**
 * Gera (idempotentemente) a instância do período atual para um template ativo.
 * A unicidade real é a constraint @@unique([templateId, period]) no banco —
 * isso aqui só evita uma query desnecessária e trata a corrida com elegância.
 */
export async function generateRoutineRun(templateId: string, actorUserId: string): Promise<GenerateResult> {
  const template = await prisma.routineTemplate.findUnique({
    where: { id: templateId },
    include: { tasks: { orderBy: { order: "asc" } } },
  });
  if (!template || template.status !== "ATIVO") {
    return { status: "not_active" };
  }

  const period = currentPeriod();
  const existing = await prisma.routineRun.findUnique({
    where: { templateId_period: { templateId, period } },
  });
  if (existing) {
    return { status: "already_exists", runId: existing.id, projectId: existing.projectId ?? undefined };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          agencyId: template.agencyId,
          clientId: template.clientId,
          name: `${template.name} · ${formatPeriodLabel(period)}`,
        },
      });

      for (const item of template.tasks) {
        const task = await tx.task.create({
          data: { projectId: project.id, title: item.title, description: item.description },
        });
        await tx.taskStatusHistory.create({
          data: { taskId: task.id, toStatus: "BACKLOG", actorUserId },
        });
      }

      const run = await tx.routineRun.create({
        data: { templateId, period, status: "CRIADA", projectId: project.id },
      });

      await tx.auditLog.create({
        data: {
          agencyId: template.agencyId,
          actorUserId,
          actorType: "user",
          action: "routine.generated",
          resourceType: "routine_run",
          resourceId: run.id,
          metadata: { period, projectId: project.id },
        },
      });

      return { runId: run.id, projectId: project.id };
    });

    return { status: "created", ...result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raceWinner = await prisma.routineRun.findUnique({
        where: { templateId_period: { templateId, period } },
      });
      return {
        status: "already_exists",
        runId: raceWinner?.id,
        projectId: raceWinner?.projectId ?? undefined,
      };
    }
    throw error;
  }
}
