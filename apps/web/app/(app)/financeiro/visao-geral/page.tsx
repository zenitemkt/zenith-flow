import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";
import { TrendAreaChart } from "@/app/_components/charts/TrendAreaChart";

const MONTH_LABELS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function VisaoGeralPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [aReceber, aPagar, recebidoMes, pagoMes, vencendo, settledLast12Months] = await Promise.all([
    prisma.financeEntry.aggregate({
      where: { agencyId: membership.agencyId, type: "RECEITA", status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] } },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: { agencyId: membership.agencyId, type: "DESPESA", status: { in: ["PREVISTO", "PENDENTE", "VENCIDO"] } },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        agencyId: membership.agencyId,
        type: "RECEITA",
        status: "LIQUIDADO",
        settledDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        agencyId: membership.agencyId,
        type: "DESPESA",
        status: "LIQUIDADO",
        settledDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.findMany({
      where: {
        agencyId: membership.agencyId,
        status: { in: ["PENDENTE", "VENCIDO"] },
        dueDate: { lte: in7Days },
      },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.financeEntry.findMany({
      where: {
        agencyId: membership.agencyId,
        status: "LIQUIDADO",
        settledDate: { gte: twelveMonthsAgo, lt: monthEnd },
      },
      select: { type: true, amountCents: true, settledDate: true },
    }),
  ]);

  const aReceberTotal = aReceber._sum.amountCents ?? 0;
  const aPagarTotal = aPagar._sum.amountCents ?? 0;
  const recebidoTotal = recebidoMes._sum.amountCents ?? 0;
  const pagoTotal = pagoMes._sum.amountCents ?? 0;
  const saldoMes = recebidoTotal - pagoTotal;

  /**
   * O mês de cada barra é o de `settledDate` (data que a pessoa informa ao
   * marcar como recebido/pago), não o de criação/vencimento — mesma regra
   * usada em /api/finance/entries/[id]/status: o dinheiro só conta no mês em
   * que efetivamente entrou/saiu do caixa.
   */
  const recebimentosMonths: { label: string; valor: number }[] = [];
  const pagosMonths: { label: string; valor: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const label = `${MONTH_LABELS_SHORT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
    recebimentosMonths.push({ label, valor: 0 });
    pagosMonths.push({ label, valor: 0 });
  }
  for (const entry of settledLast12Months) {
    if (!entry.settledDate) continue;
    const monthsAgo =
      (now.getUTCFullYear() - entry.settledDate.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - entry.settledDate.getUTCMonth());
    const index = 11 - monthsAgo;
    if (index < 0 || index >= 12) continue;
    if (entry.type === "RECEITA") {
      recebimentosMonths[index]!.valor += entry.amountCents;
    } else {
      pagosMonths[index]!.valor += entry.amountCents;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Financeiro — Visão geral</h1>
          <p className="text-sm text-[#667085]">{membership.agency.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/financeiro/caixa"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Fluxo de caixa
          </Link>
          <Link
            href="/financeiro/receber"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Contas a receber
          </Link>
          <Link
            href="/financeiro/pagar"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Contas a pagar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#166534]">{formatCents(aReceberTotal)}</p>
          <p className="text-xs text-[#667085]">a receber (previsto + pendente)</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#B42318]">{formatCents(aPagarTotal)}</p>
          <p className="text-xs text-[#667085]">a pagar (previsto + pendente)</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className="text-2xl font-semibold text-[#101828]">{formatCents(recebidoTotal)}</p>
          <p className="text-xs text-[#667085]">recebido este mês</p>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <p className={`text-2xl font-semibold ${saldoMes >= 0 ? "text-[#166534]" : "text-[#B42318]"}`}>
            {formatCents(saldoMes)}
          </p>
          <p className="text-xs text-[#667085]">saldo do mês (recebido − pago)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Recebimentos — últimos 12 meses</h2>
          <TrendAreaChart data={recebimentosMonths} dataKey="valor" format="cents" color="#12B76A" />
        </section>
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">A pagar — últimos 12 meses</h2>
          <TrendAreaChart data={pagosMonths} dataKey="valor" format="cents" color="#F04438" />
        </section>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Vencendo nos próximos 7 dias</h2>
        {vencendo.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nada vencendo nos próximos 7 dias.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {vencendo.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[#101828]">{entry.description}</p>
                  <p className="text-xs text-[#98A2B3]">
                    {entry.type === "RECEITA" ? "Receita" : "Despesa"}
                    {entry.client ? ` · ${entry.client.name}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${entry.type === "RECEITA" ? "text-[#166534]" : "text-[#B42318]"}`}
                  >
                    {formatCents(entry.amountCents)}
                  </p>
                  <p className="text-xs text-[#98A2B3]">{entry.dueDate.toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
