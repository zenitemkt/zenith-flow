import type { FinanceEntryType, FinanceEntryStatus, FinanceCategoryNature } from "@zenith/db";
import { isPastDueDate } from "./dates";

export const FINANCE_TYPE_LABELS: Record<FinanceEntryType, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

/** Seção 26.1: natureza da categoria (não o tipo) decide a linha do DRE. */
export const FINANCE_CATEGORY_NATURE_LABELS: Record<FinanceCategoryNature, string> = {
  RECEITA: "Receita",
  IMPOSTO_DEDUCAO: "Imposto/dedução (reduz a receita bruta)",
  CUSTO_DIRETO: "Custo direto de entrega",
  DESPESA_OPERACIONAL: "Despesa operacional",
  DESPESA_FINANCEIRA: "Despesa financeira",
  INVESTIMENTO: "Investimento (fora do DRE)",
  TRANSFERENCIA: "Transferência (não altera o DRE)",
};

/** Naturezas válidas quando o lançamento é DESPESA — RECEITA nunca aparece aqui, é sempre automática pra categorias de receita. */
export const DESPESA_CATEGORY_NATURES: FinanceCategoryNature[] = [
  "CUSTO_DIRETO",
  "DESPESA_OPERACIONAL",
  "DESPESA_FINANCEIRA",
  "IMPOSTO_DEDUCAO",
  "INVESTIMENTO",
  "TRANSFERENCIA",
];

/** LIQUIDADO muda de rótulo conforme o tipo — "recebido" pra receita, "pago" pra despesa. */
export const FINANCE_STATUS_LABELS: Record<FinanceEntryType, Record<FinanceEntryStatus, string>> = {
  RECEITA: {
    PREVISTO: "Previsto",
    PENDENTE: "Pendente",
    LIQUIDADO: "Recebido",
    VENCIDO: "Vencido",
    CANCELADO: "Cancelado",
  },
  DESPESA: {
    PREVISTO: "Previsto",
    PENDENTE: "Pendente",
    LIQUIDADO: "Pago",
    VENCIDO: "Vencido",
    CANCELADO: "Cancelado",
  },
};

/**
 * Seção 22: "previsto -> pendente -> pago/recebido -> vencido -> cancelado".
 * LIQUIDADO é terminal (imutável) — regra obrigatória "valores são imutáveis
 * após conciliação; correção por estorno/ajuste" implementada aqui: uma vez
 * liquidado, a única saída é criar um estorno (POST .../reverse), nunca
 * reabrir o status.
 */
export const FINANCE_STATUS_TRANSITIONS: Record<FinanceEntryStatus, FinanceEntryStatus[]> = {
  PREVISTO: ["PENDENTE", "CANCELADO"],
  PENDENTE: ["LIQUIDADO", "VENCIDO", "CANCELADO"],
  VENCIDO: ["LIQUIDADO", "CANCELADO"],
  LIQUIDADO: [],
  CANCELADO: [],
};

export function canTransitionFinanceEntry(from: FinanceEntryStatus, to: FinanceEntryStatus): boolean {
  return FINANCE_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Só é possível editar campos (valor, datas, vínculos) antes da liquidação. */
export function isFinanceEntryEditable(status: FinanceEntryStatus): boolean {
  return status === "PREVISTO" || status === "PENDENTE";
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function reaisToCents(value: number): number {
  return Math.round(value * 100);
}

export function isOverdue(entry: { status: FinanceEntryStatus; dueDate: Date }): boolean {
  return entry.status === "PENDENTE" && isPastDueDate(entry.dueDate);
}

export type FinancePeriod = "this_month" | "last_month" | "last_3_months" | "all";

export const FINANCE_PERIOD_LABELS: Record<FinancePeriod, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  last_3_months: "3 meses anteriores",
  all: "Todo período",
};

export const FINANCE_PERIODS: FinancePeriod[] = ["this_month", "last_month", "last_3_months", "all"];

/** `?period=` da URL → período válido (qualquer entrada desconhecida cai em "all"). */
export function parseFinancePeriod(value: string | undefined): FinancePeriod {
  return value && (FINANCE_PERIODS as string[]).includes(value) ? (value as FinancePeriod) : "all";
}

/** Faixa de `dueDate` (vencimento) correspondente ao período — `null` = sem filtro ("todo período"). */
export function financePeriodRange(period: FinancePeriod, now: Date = new Date()): { gte: Date; lt: Date } | null {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  switch (period) {
    case "this_month":
      return { gte: monthStart, lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
    case "last_month":
      return { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), lt: monthStart };
    case "last_3_months":
      return { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)), lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
    case "all":
      return null;
  }
}
