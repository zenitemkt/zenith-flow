import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenith/db";

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function parseYear(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : new Date().getUTCFullYear();
}

export default async function FluxoDeCaixaPage({ searchParams }: { searchParams: { year?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const year = parseYear(searchParams.year);

  const months: { year: number; month: number; start: Date; end: Date }[] = [];
  for (let month = 0; month < 12; month++) {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    months.push({ year, month, start, end });
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

  const rows = months.map(({ year: rowYear, month, start, end }) => {
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
      label: `${MONTH_LABELS[month]}/${String(rowYear).slice(2)}`,
      previstoSaldo: previstoReceita - previstoDespesa,
      realizadoSaldo: realizadoReceita - realizadoDespesa,
      previstoReceita,
      previstoDespesa,
      realizadoReceita,
      realizadoDespesa,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      previstoReceita: acc.previstoReceita + row.previstoReceita,
      previstoDespesa: acc.previstoDespesa + row.previstoDespesa,
      previstoSaldo: acc.previstoSaldo + row.previstoSaldo,
      realizadoReceita: acc.realizadoReceita + row.realizadoReceita,
      realizadoDespesa: acc.realizadoDespesa + row.realizadoDespesa,
      realizadoSaldo: acc.realizadoSaldo + row.realizadoSaldo,
    }),
    { previstoReceita: 0, previstoDespesa: 0, previstoSaldo: 0, realizadoReceita: 0, realizadoDespesa: 0, realizadoSaldo: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Fluxo de caixa</h1>
          <p className="text-sm text-[#667085]">Previsto (por competência) × realizado (por liquidação), os 12 meses do ano.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/financeiro/caixa?year=${year - 1}`}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
          >
            ← {year - 1}
          </Link>
          <span className="text-sm font-semibold text-[#101828]">{year}</span>
          <Link
            href={`/financeiro/caixa?year=${year + 1}`}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
          >
            {year + 1} →
          </Link>
        </div>
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
          <tfoot>
            <tr className="border-t-2 border-[#E4E7EC] bg-[#F9FAFB]">
              <td className="px-4 py-3 font-semibold text-[#101828]">Total {year}</td>
              <td className="px-4 py-3 font-semibold text-[#101828]">{formatCents(totals.previstoReceita)}</td>
              <td className="px-4 py-3 font-semibold text-[#101828]">{formatCents(totals.previstoDespesa)}</td>
              <td
                className={`px-4 py-3 font-semibold ${totals.previstoSaldo >= 0 ? "text-[#166534]" : "text-[#B42318]"}`}
              >
                {formatCents(totals.previstoSaldo)}
              </td>
              <td className="px-4 py-3 font-semibold text-[#101828]">{formatCents(totals.realizadoReceita)}</td>
              <td className="px-4 py-3 font-semibold text-[#101828]">{formatCents(totals.realizadoDespesa)}</td>
              <td
                className={`px-4 py-3 font-semibold ${totals.realizadoSaldo >= 0 ? "text-[#166534]" : "text-[#B42318]"}`}
              >
                {formatCents(totals.realizadoSaldo)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
