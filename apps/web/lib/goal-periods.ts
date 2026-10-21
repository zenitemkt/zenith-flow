import type { GoalMetric, GoalPeriod } from "@zenite-mkt/db";

/**
 * Helpers puros das Metas comerciais — sem Prisma, usados no servidor e em
 * client components (formulário). O cálculo do realizado mora em
 * lib/commercial-goals.ts.
 *
 * Períodos são sempre no fuso de São Paulo (-03:00, sem horário de verão
 * desde 2019): um mês começa em `AAAA-MM-01T00:00:00-03:00`.
 */
const SP_OFFSET = "-03:00";

export const GOAL_METRICS: { id: GoalMetric; label: string; description: string; money: boolean; cumulative: boolean }[] = [
  {
    id: "ACTIVE_CLIENTS",
    label: "Clientes ativos",
    description: "Quantos clientes ativos a carteira tem no fim do período.",
    money: false,
    cumulative: false,
  },
  {
    id: "REVENUE",
    label: "Faturamento",
    description: "Receitas lançadas no Financeiro com competência no período (exceto canceladas).",
    money: true,
    cumulative: true,
  },
  {
    id: "RECEIVED",
    label: "Recebido",
    description: "Receitas efetivamente recebidas (liquidadas) no período.",
    money: true,
    cumulative: true,
  },
  {
    id: "NEW_CLIENTS",
    label: "Novos clientes",
    description: "Clientes que entraram em onboarding ou ficaram ativos pela primeira vez no período.",
    money: false,
    cumulative: true,
  },
  {
    id: "WON_DEALS_VALUE",
    label: "Vendas fechadas",
    description: "Valor das oportunidades marcadas como ganhas no Pipeline no período.",
    money: true,
    cumulative: true,
  },
  {
    id: "NEW_LEADS",
    label: "Novos leads",
    description: "Leads que entraram no CRM no período.",
    money: false,
    cumulative: true,
  },
];

export const GOAL_METRIC_BY_ID = Object.fromEntries(GOAL_METRICS.map((m) => [m.id, m])) as Record<
  GoalMetric,
  (typeof GOAL_METRICS)[number]
>;

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = { MONTHLY: "Mensal", QUARTERLY: "Trimestral" };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Início do mês (0-11) em São Paulo. */
export function monthStart(year: number, month: number): Date {
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return new Date(`${y}-${pad(m + 1)}-01T00:00:00${SP_OFFSET}`);
}

/** Ano e mês (0-11) de um instante, lidos no fuso de São Paulo. */
export function spYearMonth(date: Date): { year: number; month: number } {
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

export function quarterOf(month: number): number {
  return Math.floor(month / 3);
}

/** Início normalizado do período que contém (ano, mês). */
export function periodStartFor(period: GoalPeriod, year: number, month: number): Date {
  return period === "MONTHLY" ? monthStart(year, month) : monthStart(year, quarterOf(month) * 3);
}

export function periodEnd(period: GoalPeriod, start: Date): Date {
  const { year, month } = spYearMonth(start);
  return monthStart(year, month + (period === "MONTHLY" ? 1 : 3));
}

export function periodLabel(period: GoalPeriod, start: Date): string {
  const { year, month } = spYearMonth(start);
  if (period === "MONTHLY") return `${MONTHS_FULL[month]} de ${year}`;
  const q = quarterOf(month);
  return `${q + 1}º trimestre de ${year} (${MONTHS[q * 3]}–${MONTHS[q * 3 + 2]})`;
}

export function monthParam(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

/** Lê `?mes=AAAA-MM`; inválido ou ausente = mês atual em São Paulo. */
export function parseMonthParam(raw: string | undefined, now: Date = new Date()): { year: number; month: number } {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (month >= 0 && month < 12 && year > 2000 && year < 2100) return { year, month };
  }
  return spYearMonth(now);
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS_FULL[month]![0]!.toUpperCase()}${MONTHS_FULL[month]!.slice(1)} de ${year}`;
}

/**
 * Converte o texto digitado em valor inteiro: centavos para metas em R$
 * ("30.000", "30000,50", "R$ 1.500") ou número inteiro para contagens.
 */
export function parseGoalTarget(raw: string, money: boolean): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  if (!money) {
    const n = Number(cleaned.replace(/[.,]/g, ""));
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  // "1.234,56" → 1234.56 ; "1234.56" (sem vírgula, um ponto com 2 casas) → 1234.56
  let normalized: string;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(cleaned)) normalized = cleaned;
  else normalized = cleaned.replace(/\./g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function formatGoalValue(value: number, money: boolean): string {
  if (!money) return value.toLocaleString("pt-BR");
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: value % 100 === 0 ? 0 : 2 });
}

/** Valor do campo de edição (sem "R$", com vírgula decimal). */
export function goalTargetInput(value: number, money: boolean): string {
  if (!money) return String(value);
  return (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: value % 100 === 0 ? 0 : 2 });
}
