import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenith/db";

export default async function VisaoGeralPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [aReceber, aPagar, recebidoMes, pagoMes, vencendo] = await Promise.all([
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
  ]);

  const aReceberTotal = aReceber._sum.amountCents ?? 0;
  const aPagarTotal = aPagar._sum.amountCents ?? 0;
  const recebidoTotal = recebidoMes._sum.amountCents ?? 0;
  const pagoTotal = pagoMes._sum.amountCents ?? 0;
  const saldoMes = recebidoTotal - pagoTotal;

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
