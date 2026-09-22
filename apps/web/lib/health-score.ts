import { prisma } from "@zenite-mkt/db";
import { endOfDayUTC, isPastDueDate } from "./dates";

/**
 * Seção 30 do manual: 7 dimensões (Financeiro 20, Entregas 20, Relacionamento
 * 15, Aprovações 10, Satisfação 15, Resultados 15, Contrato 5). Nesta versão
 * só calculamos as 3 com dado real e honesto disponível hoje — Financeiro,
 * Entregas, Aprovações — e renormalizamos os pesos entre elas (40/40/20),
 * em vez de incluir as outras 4 com score inventado ou zerado. Documentado
 * em docs/DECISIONS.md: um cliente sem dado numa dimensão medida usa um
 * score neutro (75, "saudável"), não 0 — falta de sinal não é o mesmo que
 * sinal ruim.
 */
export const HEALTH_SCORE_MODEL_VERSION = "v1-financeiro-entregas-aprovacoes";

const NEUTRAL_SCORE = 75;
const LOOKBACK_DAYS = 180;

const DIMENSION_WEIGHTS = {
  financeiro: 0.4,
  entregas: 0.4,
  aprovacoes: 0.2,
} as const;

export type HealthBand = "EXCELENTE" | "SAUDAVEL" | "ATENCAO" | "ALTO_RISCO";

export const HEALTH_BAND_LABELS: Record<HealthBand, string> = {
  EXCELENTE: "Excelente",
  SAUDAVEL: "Saudável",
  ATENCAO: "Atenção",
  ALTO_RISCO: "Alto risco",
};

export const HEALTH_BAND_BADGE_CLASS: Record<HealthBand, string> = {
  EXCELENTE: "bg-[#DCFCE7] text-[#166534]",
  SAUDAVEL: "bg-[#EEF2FF] text-[#3730A3]",
  ATENCAO: "bg-[#FEF3C7] text-[#92600A]",
  ALTO_RISCO: "bg-[#FEE4E2] text-[#B42318]",
};

/** Faixas da seção 30.1 do manual. */
export function bandForScore(score: number): HealthBand {
  if (score >= 90) return "EXCELENTE";
  if (score >= 75) return "SAUDAVEL";
  if (score >= 55) return "ATENCAO";
  return "ALTO_RISCO";
}

interface DimensionResult {
  score: number;
  weight: number;
  hasData: boolean;
  signals: Record<string, number | string>;
}

export interface HealthScoreBreakdown {
  financeiro: DimensionResult;
  entregas: DimensionResult;
  aprovacoes: DimensionResult;
  pendente: string[]; // dimensões do manual ainda sem dado real (Relacionamento, Satisfação, Resultados, Contrato)
}

async function computeFinanceiroDimension(agencyId: string, clientId: string, since: Date): Promise<DimensionResult> {
  const entries = await prisma.financeEntry.findMany({
    where: {
      agencyId,
      clientId,
      type: "RECEITA",
      OR: [{ status: "LIQUIDADO", settledDate: { gte: since } }, { status: "VENCIDO" }, { status: "PENDENTE" }],
    },
    select: { status: true, dueDate: true, settledDate: true },
  });

  const liquidados = entries.filter((e) => e.status === "LIQUIDADO");
  const overdueNow = entries.filter((e) => e.status === "VENCIDO" || (e.status === "PENDENTE" && isPastDueDate(e.dueDate)));

  if (liquidados.length === 0 && overdueNow.length === 0) {
    return { score: NEUTRAL_SCORE, weight: DIMENSION_WEIGHTS.financeiro, hasData: false, signals: {} };
  }

  const onTime = liquidados.filter((e) => e.settledDate && e.settledDate <= endOfDayUTC(e.dueDate)).length;
  const punctualityRate = liquidados.length > 0 ? onTime / liquidados.length : 1;
  const score = Math.max(0, Math.min(100, punctualityRate * 100 - Math.min(30, overdueNow.length * 10)));

  return {
    score: Math.round(score),
    weight: DIMENSION_WEIGHTS.financeiro,
    hasData: true,
    signals: {
      faturasLiquidadas: liquidados.length,
      pontualidade: `${Math.round(punctualityRate * 100)}%`,
      faturasEmAtraso: overdueNow.length,
    },
  };
}

async function computeEntregasDimension(agencyId: string, clientId: string, since: Date): Promise<DimensionResult> {
  const tasks = await prisma.task.findMany({
    where: { project: { agencyId, clientId } },
    select: { status: true, dueDate: true, completedAt: true },
  });

  const completed = tasks.filter((t) => t.status === "CONCLUIDA" && t.completedAt && t.completedAt >= since);
  const blocked = tasks.filter((t) => t.status === "BLOQUEADA");

  if (completed.length === 0 && blocked.length === 0) {
    return { score: NEUTRAL_SCORE, weight: DIMENSION_WEIGHTS.entregas, hasData: false, signals: {} };
  }

  const onTime = completed.filter((t) => !t.dueDate || (t.completedAt && t.completedAt <= endOfDayUTC(t.dueDate))).length;
  const onTimeRate = completed.length > 0 ? onTime / completed.length : 1;
  const score = Math.max(0, Math.min(100, onTimeRate * 100 - Math.min(20, blocked.length * 10)));

  return {
    score: Math.round(score),
    weight: DIMENSION_WEIGHTS.entregas,
    hasData: true,
    signals: {
      tarefasConcluidas: completed.length,
      noPrazo: `${Math.round(onTimeRate * 100)}%`,
      tarefasBloqueadas: blocked.length,
    },
  };
}

async function computeAprovacoesDimension(agencyId: string, clientId: string, since: Date): Promise<DimensionResult> {
  const approvals = await prisma.contentApproval.findMany({
    where: {
      status: { in: ["APROVADO", "AJUSTES_SOLICITADOS"] },
      decidedAt: { gte: since },
      contentVersion: { contentItem: { agencyId, clientId } },
    },
    select: { status: true },
  });

  if (approvals.length === 0) {
    return { score: NEUTRAL_SCORE, weight: DIMENSION_WEIGHTS.aprovacoes, hasData: false, signals: {} };
  }

  const approved = approvals.filter((a) => a.status === "APROVADO").length;
  const approvalRate = approved / approvals.length;

  return {
    score: Math.round(approvalRate * 100),
    weight: DIMENSION_WEIGHTS.aprovacoes,
    hasData: true,
    signals: { decisoes: approvals.length, aprovadasDePrimeira: `${Math.round(approvalRate * 100)}%` },
  };
}

export async function computeHealthScore(agencyId: string, clientId: string) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [financeiro, entregas, aprovacoes] = await Promise.all([
    computeFinanceiroDimension(agencyId, clientId, since),
    computeEntregasDimension(agencyId, clientId, since),
    computeAprovacoesDimension(agencyId, clientId, since),
  ]);

  const totalWeight = financeiro.weight + entregas.weight + aprovacoes.weight;
  const score = Math.round(
    (financeiro.score * financeiro.weight + entregas.score * entregas.weight + aprovacoes.score * aprovacoes.weight) /
      totalWeight,
  );

  const breakdown: HealthScoreBreakdown = {
    financeiro,
    entregas,
    aprovacoes,
    pendente: ["Relacionamento", "Satisfação (NPS/CSAT)", "Resultados", "Contrato"],
  };

  return { score, breakdown };
}
