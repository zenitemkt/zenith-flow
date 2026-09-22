import type { Prisma } from "@zenite-mkt/db";
import { roundMinutes, startOfWeekUTC } from "@/lib/timesheets";

type TxClient = Prisma.TransactionClient;

/**
 * Fecha o trecho de trabalho em andamento (cronômetro real, sem processo
 * rodando — só guarda o início e calcula a diferença aqui): mede os minutos
 * entre `currentRunStartedAt` e agora e tenta lançar um `TimeEntry` (source
 * TIMER) no timesheet da semana de quem estava com a tarefa. Se a semana já
 * foi enviada/aprovada, o lançamento é pulado (nunca bloqueia pausar/concluir
 * por causa disso), mas o cronômetro é sempre zerado. Roda dentro da
 * transação do chamador — nunca abre a sua própria.
 */
export async function closeCurrentRun(
  tx: TxClient,
  task: { id: string; currentRunStartedAt: Date | null; currentRunUserId: string | null },
  agencyId: string,
  now: Date = new Date(),
): Promise<{ logged: boolean; minutes: number | null }> {
  if (!task.currentRunStartedAt || !task.currentRunUserId) {
    return { logged: false, minutes: null };
  }

  const userId = task.currentRunUserId;
  const startedAt = task.currentRunStartedAt;
  const elapsedMinutes = roundMinutes(Math.max(now.getTime() - startedAt.getTime(), 0) / 60_000);
  const weekStart = startOfWeekUTC(startedAt);

  const timesheet = await tx.timesheet.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    create: { agencyId, userId, weekStart },
    update: {},
  });

  let logged = false;
  if (timesheet.status === "RASCUNHO" || timesheet.status === "CORRIGIDA") {
    await tx.timeEntry.create({
      data: {
        agencyId,
        userId,
        taskId: task.id,
        timesheetId: timesheet.id,
        date: startedAt,
        minutes: elapsedMinutes,
        source: "TIMER",
      },
    });
    logged = true;
  }

  await tx.task.update({
    where: { id: task.id },
    data: { currentRunStartedAt: null, currentRunUserId: null },
  });

  return { logged, minutes: elapsedMinutes };
}
