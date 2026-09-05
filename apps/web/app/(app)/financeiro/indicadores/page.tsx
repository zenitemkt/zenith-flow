import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { computeDSO, computeLogoChurnRate, INDICATOR_WINDOW_DAYS } from "@/lib/finance-indicators";
import { statusAsOf } from "@/lib/cohort";
import { prisma } from "@zenith/db";

export default async function IndicadoresPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const now = new Date();
  const periodStart = new Date(now.getTime() - INDICATOR_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [arAggregate, creditSalesAggregate, clients] = await Promise.all([
    prisma.financeEntry.aggregate({
      where: { agencyId: membership.agencyId, type: "RECEITA", status: { in: ["PENDENTE", "VENCIDO"] } },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        agencyId: membership.agencyId,
        type: "RECEITA",
        status: { not: "CANCELADO" },
        competencyDate: { gte: periodStart, lte: now },
      },
      _sum: { amountCents: true },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    }),
  ]);

  const accountsReceivableCents = arAggregate._sum.amountCents ?? 0;
  const creditSalesCents = creditSalesAggregate._sum.amountCents ?? 0;
  const dso = computeDSO(accountsReceivableCents, creditSalesCents, INDICATOR_WINDOW_DAYS);

  const clientsAtStart = clients.filter((c) => statusAsOf(c.statusHistory, periodStart) === "ATIVO").length;
  const churnedInPeriod = clients.filter((c) => {
    const wasAtStart = statusAsOf(c.statusHistory, periodStart) === "ATIVO";
    const isNowEncerrado = statusAsOf(c.statusHistory, now) === "ENCERRADO";
    return wasAtStart && isNowEncerrado;
  }).length;
  const logoChurn = computeLogoChurnRate(clientsAtStart, churnedInPeriod);

  const lastUpdated = now.toLocaleString("pt-BR");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Indicadores financeiros</h1>
        <p className="text-sm text-[#667085]">
          {membership.agency.name} · janela de {INDICATOR_WINDOW_DAYS} dias · calculado em {lastUpdated}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{dso === null ? "—" : `${dso} dias`}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">DSO (Days Sales Outstanding)</p>
          <p className="mt-2 text-xs text-[#98A2B3]">
            Fórmula: contas a receber em aberto ÷ receita a prazo dos últimos {INDICATOR_WINDOW_DAYS} dias ×{" "}
            {INDICATOR_WINDOW_DAYS}. Contas a receber (agora): pendente/vencido, todas as datas. Receita do
            período: por competência, {periodStart.toLocaleDateString("pt-BR")} a {now.toLocaleDateString("pt-BR")}.
          </p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{logoChurn === null ? "—" : `${logoChurn}%`}</p>
          <p className="mt-1 text-xs font-medium text-[#475467]">Logo churn</p>
          <p className="mt-2 text-xs text-[#98A2B3]">
            Fórmula: clientes ativos em {periodStart.toLocaleDateString("pt-BR")} que já estão encerrados hoje ÷
            clientes ativos em {periodStart.toLocaleDateString("pt-BR")} ({clientsAtStart} cliente
            {clientsAtStart === 1 ? "" : "s"}). Período: últimos {INDICATOR_WINDOW_DAYS} dias.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-[#101828]">Indicadores ainda bloqueados (seção 29)</h2>
        <ul className="list-disc pl-5 text-xs text-[#667085]">
          <li>
            <strong>MRR, ARR, ARPA, Gross/Net Revenue Churn, LTV simples</strong> — pressupõem receita recorrente
            normalizada; este projeto não modela contrato/assinatura como entidade própria (decisão da Release
            1B), então não há uma base honesta de "receita mensal recorrente" pra calcular.
          </li>
          <li>
            <strong>CAC</strong> — depende de dado de aquisição/marketing, que é Fase 3 (tracking, campanhas).
          </li>
          <li>
            <strong>Margem cliente</strong> — precisa de custo por hora/rateio aprovado; isso tocaria em dado de
            salário, que a seção 20 (RH) já evitou modelar de propósito até haver um caso real pedindo.
          </li>
        </ul>
      </section>
    </div>
  );
}
