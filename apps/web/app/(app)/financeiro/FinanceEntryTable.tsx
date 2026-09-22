import type { FinanceEntryStatus, FinanceEntryType } from "@zenite-mkt/db";
import { FINANCE_STATUS_LABELS, formatCents, isOverdue, isFinanceEntryEditable } from "@/lib/finance";
import { FinanceEntryActions } from "./FinanceEntryActions";
import { AttachBoletoButton } from "./AttachBoletoButton";
import { EditFinanceEntryButton } from "./EditFinanceEntryButton";
import { FINANCE_STATUS_TRANSITIONS } from "@/lib/finance";

export interface FinanceEntryRow {
  id: string;
  type: FinanceEntryType;
  status: FinanceEntryStatus;
  description: string;
  amountCents: number;
  dueDate: Date;
  settledDate: Date | null;
  category: { name: string } | null;
  client: { id: string; name: string } | null;
  project: { name: string } | null;
  reversalOfId: string | null;
  reversedBy: { id: string } | null;
  boletoAsset: { id: string; fileName: string } | null;
}

const STATUS_BADGE_CLASS: Record<FinanceEntryStatus, string> = {
  PREVISTO: "bg-[#F2F4F7] text-[#475467]",
  PENDENTE: "bg-[#EEF2FF] text-[#3730A3]",
  LIQUIDADO: "bg-[#DCFCE7] text-[#166534]",
  VENCIDO: "bg-[#FEE4E2] text-[#B42318]",
  CANCELADO: "bg-[#F2F4F7] text-[#98A2B3]",
};

export function FinanceEntryTable({ entries, showBoleto = false }: { entries: FinanceEntryRow[]; showBoleto?: boolean }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
        <p className="text-sm text-[#667085]">Nenhum lançamento ainda.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
          <tr>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Cliente/Projeto</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Vencimento</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Status</th>
            {showBoleto && <th className="px-4 py-3">Boleto</th>}
            <th className="px-4 py-3">Ação</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const overdue = isOverdue(entry);
            const displayStatus = overdue ? "VENCIDO" : entry.status;
            const isReversal = Boolean(entry.reversalOfId);
            return (
              <tr key={entry.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                <td className="px-4 py-3 font-medium text-[#101828]">
                  {entry.description}
                  {isReversal && (
                    <span className="ml-1.5 rounded-full bg-[#FEE4E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#B42318]">
                      estorno
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#475467]">
                  {entry.client?.name ?? entry.project?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-[#475467]">{entry.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-[#475467]">{entry.dueDate.toLocaleDateString("pt-BR")}</td>
                <td
                  className={`px-4 py-3 font-medium ${entry.amountCents < 0 ? "text-[#B42318]" : "text-[#101828]"}`}
                >
                  {formatCents(entry.amountCents)}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[displayStatus]}`}>
                    {FINANCE_STATUS_LABELS[entry.type][displayStatus]}
                  </span>
                </td>
                {showBoleto && (
                  <td className="px-4 py-3">
                    {!isReversal && (
                      <AttachBoletoButton entryId={entry.id} clientId={entry.client?.id ?? null} boleto={entry.boletoAsset} />
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-start justify-end gap-1.5">
                    {!isReversal && isFinanceEntryEditable(entry.status) && (
                      <EditFinanceEntryButton
                        entryId={entry.id}
                        description={entry.description}
                        amountCents={entry.amountCents}
                        dueDateISO={entry.dueDate.toISOString().slice(0, 10)}
                      />
                    )}
                    {!isReversal && (
                      <FinanceEntryActions
                        entryId={entry.id}
                        type={entry.type}
                        status={entry.status}
                        options={FINANCE_STATUS_TRANSITIONS[entry.status]}
                        canReverse={entry.status === "LIQUIDADO" && !entry.reversedBy}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
