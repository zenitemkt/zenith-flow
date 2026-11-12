import { formatCents } from "@/lib/finance";
import type { PayoutPayment, PayoutSummary } from "@/lib/partner-payouts";
import { PayoutButton } from "./PayoutButton";

export interface PayoutRow {
  partnerId: string;
  name: string;
  summary: PayoutSummary;
  payments: PayoutPayment[];
}

/** Quadro do fechamento: quanto cada sócio tem a receber da agência no mês e quanto já foi repassado. */
export function PayoutTable({ month, monthLabel, rows, canManage }: { month: string; monthLabel: string; rows: PayoutRow[]; canManage: boolean }) {
  if (rows.length === 0) return null;
  const cell = "px-4 py-2.5 text-right tabular-nums";
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-sm font-semibold text-[#101828]">Repasse aos sócios — {monthLabel}</h2>
      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Sócio</th>
              <th className="px-4 py-3 text-right">Parte no mês</th>
              <th className="px-4 py-3 text-right">Em aberto</th>
              <th className="px-4 py-3 text-right">Repassado</th>
              <th className="px-4 py-3 text-right">Pendente</th>
              <th className="px-4 py-3 text-right">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.partnerId} className="border-t border-[#EEF0F3]">
                <td className="px-4 py-2.5 font-medium text-[#101828]">{row.name}</td>
                <td className={`${cell} text-[#344054]`}>{formatCents(row.summary.totalCents)}</td>
                <td className={`${cell} text-[#667085]`}>{formatCents(row.summary.openCents)}</td>
                <td className={`${cell} text-[#166534]`}>{formatCents(row.summary.paidCents)}</td>
                <td className={`${cell} font-semibold ${row.summary.pendingCents > 0 ? "text-[#92600A]" : row.summary.pendingCents < 0 ? "text-[#3730A3]" : "text-[#101828]"}`}>
                  {formatCents(row.summary.pendingCents)}
                </td>
                <td className="px-4 py-2">
                  <PayoutButton
                    partnerId={row.partnerId}
                    partnerName={row.name}
                    month={month}
                    monthLabel={monthLabel}
                    summary={row.summary}
                    payments={row.payments}
                    canManage={canManage}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#667085]">
        Parte no mês: a parte do sócio nas receitas da Zenite que vencem no mês. Em aberto: o que os clientes ainda não pagaram. Pendente: o que
        a Zenite já recebeu e ainda não foi repassado (negativo = adiantado).
      </p>
    </section>
  );
}
