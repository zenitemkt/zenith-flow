import type { FinanceEntryType, FinanceEntryStatus } from "@zenith/db";

export const FINANCE_TYPE_LABELS: Record<FinanceEntryType, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

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
  return entry.status === "PENDENTE" && entry.dueDate.getTime() < Date.now();
}
