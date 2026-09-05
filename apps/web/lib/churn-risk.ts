import { prisma } from "@zenith/db";
import { endOfDayUTC, isPastDueDate } from "./dates";

/**
 * Seção 31 do manual: "Churn Risk estima necessidade de intervenção. Na
 * primeira versão, usar regras explicáveis; modelo estatístico/ML somente
 * depois de volume e qualidade suficientes." Diferente do Health Score (média
 * ponderada de dimensões), este é um modelo ADITIVO de sinais — cada sinal
 * disparado soma pontos fixos, sem normalização, exatamente como a tabela da
 * seção 31 descreve.
 *
 * Só 3 dos 6 sinais do manual entram no cálculo — os únicos com dado real
 * hoje: queda/nível de Health Score, faturas atrasadas, entregas atrasadas.
 * Os outros 3 (renovação de contrato, NPS detrator, ausência de
 * reunião/resposta) dependem de módulos que não existem ainda (contrato como
 * entidade própria, NPS, SLA de atendimento) — ficam listados como
 * "pendente", nunca como score inventado. Ver docs/DECISIONS.md.
 */
export const CHURN_RISK_MODEL_VERSION = "v1-health-financeiro-entregas";

const HEALTH_DELTA_LOOKBACK_DAYS = 30;
const OVERDUE_INVOICES_LOOKBACK_DAYS = 90;
const LATE_DELIVERIES_LOOKBACK_DAYS = 90;

const SIGNAL_WEIGHTS = {
  health: 25,
  faturasAtrasadas: 20,
  entregasAtrasadas: 15,
} as const;

export type ChurnBand = "BAIXO" | "MEDIO" | "ALTO";

export const CHURN_BAND_LABELS: Record<ChurnBand, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
};

export const CHURN_BAND_BADGE_CLASS: Record<ChurnBand, string> = {
  BAIXO: "bg-[#DCFCE7] text-[#166534]",
  MEDIO: "bg-[#FEF3C7] text-[#92600A]",
  ALTO: "bg-[#FEE4E2] text-[#B42318]",
};

/**
 * Bandas pragmáticas — o manual não define cortes numéricos para o score de
 * churn (só os pesos de cada sinal). Com os 3 sinais implementados, o score
 * máximo alcançável é 60 (25+20+15); ALTO exige os três sinais disparados ao
 * mesmo tempo, o que é, de fato, crítico.
 */
export function bandForChurnScore(score: number): ChurnBand {
  if (score >= 45) return "ALTO";
  if (score >= 25) return "MEDIO";
  return "BAIXO";
}

interface SignalResult {
  triggered: boolean;
  weight: number;
  hasData: boolean;
  details: Record<string, number | string | boolean>;
}

export interface ChurnRiskSignals {
  health: SignalResult;
  faturasAtrasadas: SignalResult;
  entregasAtrasadas: SignalResult;
  pendente: string[];
  recoveryPlanActive: boolean;
}

async function computeHealthSignal(clientId: string): Promise<SignalResult> {
  const since = new Date(Date.now() - HEALTH_DELTA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [current, past] = await Promise.all([
    prisma.healthScoreSnapshot.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    prisma.healthScoreSnapshot.findFirst({
      where: { clientId, createdAt: { lte: since } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!current) {
    return { triggered: false, weight: 0, hasData: false, details: {} };
  }

  const delta = past ? current.score - past.score : 0;
  const lowScore = current.score < 55;
  const bigDrop = past !== null && delta <= -15;

  return {
    triggered: lowScore || bigDrop,
    weight: lowScore || bigDrop ? SIGNAL_WEIGHTS.health : 0,
    hasData: true,
    details: {
      healthAtual: current.score,
      quedaEm30Dias: past ? delta : "sem comparação (< 30 dias de histórico)",
    },
  };
}

async function computeOverdueInvoicesSignal(agencyId: string, clientId: string): Promise<SignalResult> {
  const since = new Date(Date.now() - OVERDUE_INVOICES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const entries = await prisma.financeEntry.findMany({
    where: {
      agencyId,
      clientId,
      type: "RECEITA",
      dueDate: { gte: since },
      OR: [{ status: "VENCIDO" }, { status: "PENDENTE" }],
    },
    select: { status: true, dueDate: true },
  });

  const overdue = entries.filter((e) => e.status === "VENCIDO" || isPastDueDate(e.dueDate));
  const triggered = overdue.length >= 2;

  return {
    triggered,
    weight: triggered ? SIGNAL_WEIGHTS.faturasAtrasadas : 0,
    hasData: entries.length > 0,
    details: { faturasAtrasadas: overdue.length },
  };
}

async function computeLateDeliveriesSignal(agencyId: string, clientId: string): Promise<SignalResult> {
  const since = new Date(Date.now() - LATE_DELIVERIES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: { project: { agencyId, clientId } },
    select: { status: true, dueDate: true, completedAt: true },
  });

  const late = tasks.filter((t) => {
    if (!t.dueDate) return false;
    if (t.status === "CONCLUIDA") {
      return t.completedAt !== null && t.completedAt >= since && t.completedAt > endOfDayUTC(t.dueDate);
    }
    return t.status !== "CANCELADA" && isPastDueDate(t.dueDate);
  });

  const triggered = late.length >= 3;

  return {
    triggered,
    weight: triggered ? SIGNAL_WEIGHTS.entregasAtrasadas : 0,
    hasData: tasks.some((t) => t.dueDate !== null),
    details: { entregasAtrasadas: late.length },
  };
}

export async function computeChurnRisk(agencyId: string, clientId: string) {
  const [health, faturasAtrasadas, entregasAtrasadas, activePlan] = await Promise.all([
    computeHealthSignal(clientId),
    computeOverdueInvoicesSignal(agencyId, clientId),
    computeLateDeliveriesSignal(agencyId, clientId),
    prisma.retentionPlan.findFirst({ where: { agencyId, clientId, status: "ATIVO" } }),
  ]);

  const score = health.weight + faturasAtrasadas.weight + entregasAtrasadas.weight;
  const band = bandForChurnScore(score);

  const signals: ChurnRiskSignals = {
    health,
    faturasAtrasadas,
    entregasAtrasadas,
    pendente: [
      "Contrato termina em ≤45 dias sem renovação iniciada",
      "NPS detrator / reclamação crítica",
      "Sem reunião/resposta no intervalo acordado",
    ],
    recoveryPlanActive: activePlan !== null,
  };

  return { score, band, signals };
}
