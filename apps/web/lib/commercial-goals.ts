import { prisma, type CommercialGoal, type GoalMetric } from "@zenite-mkt/db";
import { isClientActive } from "@/lib/clients";
import { GOAL_METRIC_BY_ID, periodEnd } from "@/lib/goal-periods";

export type GoalPace = "achieved" | "on_track" | "behind" | "missed" | "upcoming";

export interface GoalProgress {
  goal: CommercialGoal;
  actual: number;
  percent: number;
  /** Fração do período já decorrida (0-1). */
  elapsed: number;
  pace: GoalPace;
  /** Quanto falta para bater a meta (0 se já bateu). */
  remaining: number;
  /** Quanto precisa por dia até o fim (só métricas acumulativas em andamento). */
  perDayNeeded: number | null;
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Realizado de uma métrica no intervalo [start, end). `asOf` limita até onde
 * olhar (agora, quando o período ainda está em andamento).
 */
async function computeActual(agencyId: string, metric: GoalMetric, start: Date, end: Date, asOf: Date): Promise<number> {
  const until = asOf < end ? asOf : end;

  switch (metric) {
    case "REVENUE": {
      const agg = await prisma.financeEntry.aggregate({
        where: { agencyId, type: "RECEITA", status: { not: "CANCELADO" }, competencyDate: { gte: start, lt: end } },
        _sum: { amountCents: true },
      });
      return agg._sum.amountCents ?? 0;
    }
    case "RECEIVED": {
      const agg = await prisma.financeEntry.aggregate({
        where: { agencyId, type: "RECEITA", status: "LIQUIDADO", settledDate: { gte: start, lt: until } },
        _sum: { amountCents: true },
      });
      return agg._sum.amountCents ?? 0;
    }
    case "NEW_LEADS":
      return prisma.lead.count({ where: { agencyId, createdAt: { gte: start, lt: until } } });
    case "WON_DEALS_VALUE": {
      const wins = await prisma.opportunityStatusHistory.findMany({
        where: { toStatus: "WON", createdAt: { gte: start, lt: until }, opportunity: { agencyId, status: "WON" } },
        select: { opportunityId: true, opportunity: { select: { valueCents: true } } },
      });
      const byOpportunity = new Map(wins.map((w) => [w.opportunityId, w.opportunity.valueCents ?? 0]));
      return [...byOpportunity.values()].reduce((sum, v) => sum + v, 0);
    }
    case "NEW_CLIENTS": {
      // Primeira vez que o cliente entrou em ONBOARDING/ATIVO — reativação não conta como cliente novo.
      const clients = await prisma.client.findMany({
        where: { agencyId },
        select: {
          statusHistory: {
            where: { toStatus: { in: ["ONBOARDING", "ATIVO"] } },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      });
      return clients.filter((c) => {
        const first = c.statusHistory[0]?.createdAt;
        return first !== undefined && first >= start && first < until;
      }).length;
    }
    case "ACTIVE_CLIENTS": {
      // Status de cada cliente no instante `until`, reconstruído pelo histórico.
      const clients = await prisma.client.findMany({
        where: { agencyId, createdAt: { lt: until } },
        select: {
          status: true,
          statusHistory: { where: { createdAt: { lt: until } }, orderBy: { createdAt: "desc" }, take: 1, select: { toStatus: true } },
        },
      });
      return clients.filter((c) => isClientActive(c.statusHistory[0]?.toStatus ?? c.status)).length;
    }
  }
}

export async function computeGoalProgress(goal: CommercialGoal, now: Date = new Date()): Promise<GoalProgress> {
  const start = goal.periodStart;
  const end = periodEnd(goal.period, start);
  const actual = start > now ? 0 : await computeActual(goal.agencyId, goal.metric, start, end, now);
  const percent = goal.target > 0 ? (actual / goal.target) * 100 : 0;
  const total = end.getTime() - start.getTime();
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / total));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  const remaining = Math.max(0, goal.target - actual);
  const cumulative = GOAL_METRIC_BY_ID[goal.metric].cumulative;

  let pace: GoalPace;
  if (actual >= goal.target) pace = "achieved";
  else if (now >= end) pace = "missed";
  else if (now < start) pace = "upcoming";
  // Acumulativas: compara com o esperado proporcional ao tempo. Clientes ativos é um retrato, não acumula.
  else if (cumulative) pace = percent >= elapsed * 100 - 5 ? "on_track" : "behind";
  else pace = percent >= 90 ? "on_track" : "behind";

  const perDayNeeded = cumulative && remaining > 0 && now < end && now >= start && daysLeft > 0 ? remaining / daysLeft : null;

  return { goal, actual, percent, elapsed, pace, remaining, perDayNeeded, daysLeft };
}
