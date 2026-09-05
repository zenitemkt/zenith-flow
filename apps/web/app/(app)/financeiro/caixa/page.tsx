import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenith/db";

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export default async function FluxoDeCaixaPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const now = new Date();
  const months: { year: number; month: number; start: Date; end: Date }[] = [];
  for (let i = -2; i <= 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const start = d;
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth(), start, end });
  }

  const rangeStart = months[0]!.start;
  const rangeEnd = months[months.length - 1]!.end;

  const entries = await prisma.financeEntry.findMany({
    where: {
      agencyId: membership.agencyId,
      OR: [
        { competencyDate: { gte: rangeStart, lt: rangeEnd } },
        { settledDate: { gte: rangeStart, lt: rangeEnd } },
      ],
    },
    select: {
      type: true,
      status: true,
      amountCents: true,
      competencyDate: true,
      settledDate: true,
    },
  });

  const rows = months.map(({ year, month, start, end }) => {
    let previstoReceita = 0;
    let previstoDespesa = 0;
    let realizadoReceita = 0;
    let realizadoDespesa = 0;

    for (const entry of entries) {
      const inCompetency = entry.competencyDate >= start && entry.competencyDate < end;
      const inSettled = entry.settledDate && entry.settledDate >= start && entry.settledDate < end;

      if (entry.status === "LIQUIDADO" && inSettled) {
        if (entry.type === "RECEITA") realizadoReceita += entry.amountCents;
        else realizadoDespesa += entry.amountCents;
      } else if (entry.status !== "LIQUIDADO" && entry.status !== "CANCELADO" && inCompetency) {
        if (entry.type === "RECEITA") previstoReceita += entry.amountCents;
        else previstoDespesa += entry.amountCents;
      }
    }

    return {
      label: `${MONTH_LABELS[month]}/${String(year).slice(2)}`,
      previstoSaldo: previstoReceita - previstoDespesa,
      realizadoSaldo: realizadoReceita - realizadoDespesa,
      previstoReceita,
      previstoDespesa,
      realizadoReceita,
      realizadoDespesa,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Fluxo de caixa</h1>
        <p className="text-sm text-[#667085]">Previsto (por competência) × realizado (por liquidação), 6 meses.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3">Receita prevista</th>
              <th className="px-4 py-3">Despesa prevista</th>
              <th className="px-4 py-3">Saldo previsto</th>
              <th className="px-4 py-3">Receita realizada</th>
              <th className="px-4 py-3">Despesa realizada</th>
              <th className="px-4 py-3">Saldo realizado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-[#EEF0F3]">
                <td className="px-4 py-3 font-medium text-[#101828]">{row.label}</td>
                <td className="px-4 py-3 text-[#475467]">{formatCents(row.previstoReceita)}</td>
                <td className="px-4 py-3 text-[#475467]">{formatCents(row.previstoDespesa)}</td>
                <td
                  className={`px-4 py-3 font-medium ${row.previstoSaldo >= 0 ? "text-[#166534]" : "text-[#B42318]"}`}
                >
                  {formatCents(row.previstoSaldo)}
                </td>
                <td className="px-4 py-3 text-[#475467]">{formatCents(row.realizadoReceita)}</td>
                <td className="px-4 py-3 text-[#475467]">{formatCents(row.realizadoDespesa)}</td>
                <td
                  className={`px-4 py-3 font-medium ${row.realizadoSaldo >= 0 ? "text-[#166534]" : "text-[#B42318]"}`}
                >
                  {formatCents(row.realizadoSaldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
