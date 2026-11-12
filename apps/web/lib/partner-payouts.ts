import { prisma, type Prisma } from "@zenite-mkt/db";
import { SCOPE_ZENITE, scopeEntryWhere, type FinanceViewer } from "@/lib/finance-scope";

/**
 * Repasse do fechamento do mês (2026-11-12): o que a agência deve a cada
 * sócio é a parte dele das receitas da Zenite (divididas) já recebidas com
 * vencimento naquele mês — a mesma conta da coluna "Recebido" do quadro em
 * Contas a receber, para o número do botão ser o que está na tela.
 */
export function parseMonthKey(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1));
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(monthStart: Date): { gte: Date; lt: Date } {
  return { gte: monthStart, lt: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)) };
}

/** Receitas da Zenite recebidas, com vencimento no mês. */
export function payoutBaseWhere(viewer: FinanceViewer, monthStart: Date): Prisma.FinanceEntryWhereInput {
  return { AND: [scopeEntryWhere(viewer, SCOPE_ZENITE)], type: "RECEITA", status: "LIQUIDADO", dueDate: monthRange(monthStart) };
}

/** Parte de um sócio a receber da agência naquele mês (centavos). */
export async function partnerPayoutDue(agencyId: string, viewer: FinanceViewer, partnerId: string, monthStart: Date): Promise<number> {
  const sum = await prisma.financeEntryShare.aggregate({
    where: { partnerId, financeEntry: { ...payoutBaseWhere(viewer, monthStart), agencyId } },
    _sum: { amountCents: true },
  });
  return sum._sum.amountCents ?? 0;
}

export interface PayoutState {
  paid: boolean;
  /** Valor registrado na baixa. */
  paidCents: number | null;
  paidAtISO: string | null;
}

/** Repasses já baixados do mês, por sócio. */
export async function payoutsOfMonth(agencyId: string, monthStart: Date): Promise<Record<string, PayoutState>> {
  const rows = await prisma.partnerPayout.findMany({ where: { agencyId, month: monthStart } });
  return Object.fromEntries(rows.map((r) => [r.partnerId, { paid: true, paidCents: r.amountCents, paidAtISO: r.paidAt.toISOString() }]));
}
