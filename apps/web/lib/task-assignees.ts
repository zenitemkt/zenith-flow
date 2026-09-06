import { prisma, type Prisma } from "@zenith/db";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Fila sequencial de responsáveis (seção "Kanban unificado de Operação", ver
 * docs/DECISIONS.md): concluir a parte de quem está na vez promove o próximo
 * `order` — `Task.assigneeUserId` é sempre mantido em sincronia como cache de
 * "quem está na vez agora" (é o que a Home e `/pessoas/horas` já sabem ler).
 * Quando não há próximo, a Task inteira fecha como CONCLUIDA.
 *
 * Sempre roda dentro da transação do chamador (nunca abre a sua própria) —
 * autoral do padrão: `apps/web/lib/employees-create.ts`.
 */
export async function advanceAssigneeQueue(
  client: Client,
  taskId: string,
  actorUserId: string,
): Promise<{ nextUserId: string | null; taskCompleted: boolean }> {
  const task = await client.task.findUniqueOrThrow({ where: { id: taskId } });

  if (task.assigneeUserId) {
    const current = await client.taskAssignee.findFirst({
      where: { taskId, userId: task.assigneeUserId, completedAt: null },
      orderBy: { order: "asc" },
    });
    if (current) {
      await client.taskAssignee.update({ where: { id: current.id }, data: { completedAt: new Date() } });
      const next = await client.taskAssignee.findFirst({
        where: { taskId, order: { gt: current.order }, completedAt: null },
        orderBy: { order: "asc" },
      });
      if (next) {
        await client.task.update({
          where: { id: taskId },
          data: { status: "BACKLOG", assigneeUserId: next.userId },
        });
        await client.taskStatusHistory.create({
          data: {
            taskId,
            fromStatus: task.status,
            toStatus: "BACKLOG",
            reason: "Avançou pro próximo responsável da fila",
            actorUserId,
          },
        });
        return { nextUserId: next.userId, taskCompleted: false };
      }
    }
  }

  await client.task.update({
    where: { id: taskId },
    data: { status: "CONCLUIDA", completedAt: new Date(), assigneeUserId: null },
  });
  await client.taskStatusHistory.create({
    data: { taskId, fromStatus: task.status, toStatus: "CONCLUIDA", actorUserId },
  });
  return { nextUserId: null, taskCompleted: true };
}
