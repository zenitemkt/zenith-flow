import { FileDown } from "lucide-react";
import { requirePortalContext } from "@/lib/portal";
import { FINANCE_STATUS_LABELS, formatCents, isOverdue } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";
import { EmptyState, PageHeader, panelClass } from "../_components/ui";

const STATUS_PILL: Record<string, string> = {
  PREVISTO: "bg-white/[0.07] text-[#D6D3CF]",
  PENDENTE: "bg-[#F5B544]/[0.13] text-[#F7C66A]",
  LIQUIDADO: "bg-[#16A36A]/[0.15] text-[#5EE0A6]",
  VENCIDO: "bg-[#D94343]/[0.16] text-[#FF8A80]",
  CANCELADO: "bg-white/[0.05] text-[#6B6D7C]",
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

  const open = entries.filter((entry) => entry.status === "PENDENTE" || entry.status === "PREVISTO" || entry.status === "VENCIDO");
  const openTotal = open.reduce((sum, entry) => sum + entry.amountCents, 0);
  const overdueCount = entries.filter((entry) => isOverdue(entry)).length;
  const nextDue = open
    .filter((entry) => !isOverdue(entry))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Financeiro" description="Suas faturas com a agência e os boletos pra pagamento." />

      {entries.length === 0 ? (
        <EmptyState title="Nenhuma fatura no momento">Quando houver uma cobrança, ela aparece aqui com o boleto.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`${panelClass} p-6`}>
              <p className="text-sm text-[#8B8D9A]">Em aberto</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">{formatCents(openTotal)}</p>
              {overdueCount > 0 && (
                <p className="mt-2 text-sm text-[#FF8A80]">
                  {overdueCount} {overdueCount === 1 ? "fatura vencida" : "faturas vencidas"}
                </p>
              )}
            </div>
            <div className={`${panelClass} p-6`}>
              <p className="text-sm text-[#8B8D9A]">Próximo vencimento</p>
              {nextDue ? (
                <>
                  <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em]">
                    {nextDue.dueDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </p>
                  <p className="mt-2 truncate text-sm text-[#A3A5B2]">
                    {formatCents(nextDue.amountCents)}, {nextDue.description}
                  </p>
                </>
              ) : (
                <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em] text-[#5EE0A6]">Nada a vencer</p>
              )}
            </div>
          </div>

          <div className={`${panelClass} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/[0.06] text-xs text-[#8B8D9A]">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Descrição</th>
                  <th className="px-4 py-3.5 font-medium">Vencimento</th>
                  <th className="px-4 py-3.5 font-medium">Valor</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
                  <th className="px-6 py-3.5 text-right font-medium">Boleto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {entries.map((entry) => {
                  const overdue = isOverdue(entry);
                  return (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 text-[#F5F2EE]">{entry.description}</td>
                      <td className="px-4 py-4 text-[#A3A5B2]">{entry.dueDate.toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-4 font-medium text-[#F5F2EE]">{formatCents(entry.amountCents)}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            overdue ? STATUS_PILL.VENCIDO : STATUS_PILL[entry.status]
                          }`}
                        >
                          {overdue ? "Vencido" : FINANCE_STATUS_LABELS.RECEITA[entry.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {entry.boletoAsset ? (
                          <a
                            href={`/api/media/${entry.boletoAsset.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-[#FF8A5C] hover:text-[#FFB08F]"
                          >
                            <FileDown size={15} aria-hidden />
                            Baixar PDF
                          </a>
                        ) : (
                          <span className="text-[#5E6070]">Sem boleto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
