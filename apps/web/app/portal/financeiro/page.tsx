import { requirePortalContext } from "@/lib/portal";
import { FINANCE_STATUS_LABELS, formatCents, isOverdue } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";

const STATUS_BADGE_CLASS: Record<string, string> = {
  PREVISTO: "bg-[#F2F4F7] text-[#475467]",
  PENDENTE: "bg-[#FEF3C7] text-[#92600A]",
  LIQUIDADO: "bg-[#DCFCE7] text-[#166534]",
  VENCIDO: "bg-[#FEE4E2] text-[#B42318]",
  CANCELADO: "bg-[#F2F4F7] text-[#98A2B3]",
};

/**
 * Seção 18, regra obrigatória: "visibilidade por módulo e workspace;
 * custo/margem internos nunca aparecem." Só mostramos as próprias RECEITAs
 * (o que o cliente deve à agência) — nunca DESPESA, nunca valores internos
 * de custo/margem, que não existem nesta consulta de propósito.
 */
export default async function PortalFinanceiroPage() {
  const { client } = await requirePortalContext();

  const entries = await prisma.financeEntry.findMany({
    where: { clientId: client.id, type: "RECEITA", status: { not: "CANCELADO" } },
    include: { boletoAsset: { select: { id: true, fileName: true } } },
    orderBy: { dueDate: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Financeiro</h1>
        <p className="text-sm text-[#667085]">Suas faturas com a agência (seção 18 do manual).</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma fatura no momento.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Boleto</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const overdue = isOverdue(entry);
                return (
                  <tr key={entry.id} className="border-t border-[#EEF0F3]">
                    <td className="px-4 py-3 text-[#101828]">{entry.description}</td>
                    <td className="px-4 py-3 text-[#475467]">{entry.dueDate.toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 font-medium text-[#101828]">{formatCents(entry.amountCents)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          overdue ? STATUS_BADGE_CLASS.VENCIDO : STATUS_BADGE_CLASS[entry.status]
                        }`}
                      >
                        {overdue ? "Vencido" : FINANCE_STATUS_LABELS.RECEITA[entry.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.boletoAsset ? (
                        <a
                          href={`/api/media/${entry.boletoAsset.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#FF2B00] hover:underline"
                        >
                          Baixar PDF
                        </a>
                      ) : (
                        <span className="text-[#98A2B3]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
