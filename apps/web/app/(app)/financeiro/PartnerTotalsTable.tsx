import type { ReactNode } from "react";
import { formatCents } from "@/lib/finance";
import type { ScopeTotalRow } from "@/lib/finance-partner-totals";

/**
 * Quadro "Zenite e sócios": Zenite (dividido) com a parte de cada sócio
 * logo abaixo, o particular de quem o login pode ver, "Não definido" e o
 * total. Uma coluna por recorte; `actions` acrescenta uma coluna final (ex.:
 * repasse pendente/pago) nas linhas indicadas.
 */
export function PartnerTotalsTable({
  title,
  columns,
  rows,
  totals,
  balance,
  actions,
  actionLabel,
  footnote,
}: {
  title: string;
  columns: string[];
  rows: ScopeTotalRow[];
  totals: number[];
  /** Coluna extra "Saldo" = coluna `plus` − coluna `minus` (índices de `columns`). */
  balance?: { label: string; plus: number; minus: number };
  /** Conteúdo da coluna de ação por `row.key`. */
  actions?: Record<string, ReactNode>;
  actionLabel?: string;
  footnote?: string;
}) {
  if (rows.length === 0) return null;
  const cell = "px-4 py-2.5 text-right tabular-nums";
  const saldo = (cents: number[]) => (balance ? cents[balance.plus]! - cents[balance.minus]! : 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">{title}</th>
              {columns.map((c) => (
                <th key={c} className="px-4 py-3 text-right">
                  {c}
                </th>
              ))}
              {balance && <th className="px-4 py-3 text-right">{balance.label}</th>}
              {actions && <th className="px-4 py-3 text-right">{actionLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sub = row.kind === "part";
              return (
                <tr key={row.key} className="border-t border-[#EEF0F3]">
                  <td
                    className={`px-4 py-2.5 ${
                      sub ? "pl-8 text-[#475467]" : row.kind === "none" ? "font-medium text-[#98A2B3]" : "font-medium text-[#101828]"
                    }`}
                  >
                    {sub ? `↳ ${row.label}` : row.label}
                  </td>
                  {row.cents.map((c, i) => (
                    <td key={i} className={`${cell} ${sub ? "text-[#667085]" : "text-[#344054]"}`}>
                      {formatCents(c)}
                    </td>
                  ))}
                  {balance && (
                    <td className={`${cell} ${sub ? "" : "font-medium"} ${saldo(row.cents) < 0 ? "text-[#B42318]" : sub ? "text-[#667085]" : "text-[#101828]"}`}>
                      {formatCents(saldo(row.cents))}
                    </td>
                  )}
                  {actions && <td className="px-4 py-2 text-right">{actions[row.key] ?? null}</td>}
                </tr>
              );
            })}
            <tr className="border-t border-[#E4E7EC] bg-[#F9FAFB] font-semibold text-[#101828]">
              <td className="px-4 py-2.5">Total que você vê</td>
              {totals.map((c, i) => (
                <td key={i} className={cell}>
                  {formatCents(c)}
                </td>
              ))}
              {balance && <td className={`${cell} ${saldo(totals) < 0 ? "text-[#B42318]" : ""}`}>{formatCents(saldo(totals))}</td>}
              {actions && <td />}
            </tr>
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-xs text-[#667085]">{footnote}</p>}
    </div>
  );
}
