import { formatCents } from "@/lib/finance";
import type { PartnerTotalRow } from "@/lib/finance-partner-totals";

/** Quadro "por sócio": uma linha por sócio (mais "Não definido" e o total), uma coluna por recorte. */
export function PartnerTotalsTable({
  title,
  columns,
  rows,
  totals,
  balance,
}: {
  title: string;
  columns: string[];
  rows: PartnerTotalRow[];
  totals: number[];
  /** Coluna extra "Saldo" = coluna `plus` − coluna `minus` (índices de `columns`). */
  balance?: { label: string; plus: number; minus: number };
}) {
  if (rows.length === 0) return null;
  const cell = "px-4 py-2.5 text-right tabular-nums";
  const saldo = (cents: number[]) => (balance ? cents[balance.plus]! - cents[balance.minus]! : 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
          <tr>
            <th className="px-4 py-3">{title}</th>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3 text-right">
                {c}
              </th>
            ))}
            {balance && <th className="px-4 py-3 text-right">{balance.label}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.partnerId ?? "none"} className="border-t border-[#EEF0F3]">
              <td className={`px-4 py-2.5 font-medium ${row.partnerId ? "text-[#101828]" : "text-[#98A2B3]"}`}>{row.name}</td>
              {row.cents.map((c, i) => (
                <td key={i} className={`${cell} text-[#475467]`}>
                  {formatCents(c)}
                </td>
              ))}
              {balance && <td className={`${cell} font-medium ${saldo(row.cents) < 0 ? "text-[#B42318]" : "text-[#101828]"}`}>{formatCents(saldo(row.cents))}</td>}
            </tr>
          ))}
          <tr className="border-t border-[#E4E7EC] bg-[#F9FAFB] font-semibold text-[#101828]">
            <td className="px-4 py-2.5">Total (todos juntos)</td>
            {totals.map((c, i) => (
              <td key={i} className={cell}>
                {formatCents(c)}
              </td>
            ))}
            {balance && <td className={`${cell} ${saldo(totals) < 0 ? "text-[#B42318]" : ""}`}>{formatCents(saldo(totals))}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
