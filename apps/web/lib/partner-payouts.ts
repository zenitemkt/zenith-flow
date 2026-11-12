import { prisma } from "@zenite-mkt/db";

/**
 * Repasse do fechamento do mês (2026-11-12). Para cada sócio, no mês:
 * - parte no mês: a parte dele nas receitas da Zenite (divididas) que vencem
 *   no mês — o que a agência deve a ele quando tudo for recebido;
 * - em aberto: a parte que os clientes ainda não pagaram;
 * - repassado: a soma dos pagamentos digitados (`PartnerPayout`);
 * - pendente: o que a Zenite já recebeu da parte dele e ainda não foi repassado.
 */
export function parseMonthKey(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1));
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface PayoutPayment {
  id: string;
  amountCents: number;
  paidAtISO: string;
  note: string | null;
}

export interface PayoutSummary {
  totalCents: number;
  openCents: number;
  receivedCents: number;
  paidCents: number;
  pendingCents: number;
  status: "nothing" | "pending" | "partial" | "paid";
}

/** Conta pura do repasse de um sócio no mês (testada). */
export function summarizePayout(openCents: number, receivedCents: number, paidCents: number): PayoutSummary {
  const totalCents = openCents + receivedCents;
  const pendingCents = receivedCents - paidCents;
  const status =
    totalCents <= 0 && paidCents <= 0 ? "nothing" : paidCents >= totalCents && totalCents > 0 ? "paid" : paidCents > 0 ? "partial" : "pending";
  return { totalCents, openCents, receivedCents, paidCents, pendingCents, status };
}

/** Pagamentos de repasse do mês, por sócio (mais antigos primeiro). */
export async function payoutPaymentsOfMonth(agencyId: string, monthStart: Date): Promise<Record<string, PayoutPayment[]>> {
  const rows = await prisma.partnerPayout.findMany({ where: { agencyId, month: monthStart }, orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] });
  const out: Record<string, PayoutPayment[]> = {};
  for (const r of rows) {
    (out[r.partnerId] ??= []).push({ id: r.id, amountCents: r.amountCents, paidAtISO: r.paidAt.toISOString(), note: r.note });
  }
  return out;
}
