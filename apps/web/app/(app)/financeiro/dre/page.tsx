import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { parseMonth, monthParam, adjacentMonths, MONTH_LABELS } from "@/lib/content-calendar";
import { computeDre } from "@/lib/dre";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenith/db";

interface PageProps {
  searchParams: { month?: string };
}

export default async function DrePage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const { year, month } = parseMonth(searchParams.month);
  const rangeStart = new Date(Date.UTC(year, month, 1));
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1));
  const { prevMonth, nextMonth } = adjacentMonths(year, month);

  const entries = await prisma.financeEntry.findMany({
    where: {
      agencyId: membership.agencyId,
      status: { not: "CANCELADO" },
      competencyDate: { gte: rangeStart, lt: rangeEnd },
    },
    include: { category: { select: { nature: true } } },
  });

  const dre = computeDre(entries.map((e) => ({ amountCents: e.amountCents, type: e.type, nature: e.category?.nature ?? null })));

  const rows: { label: string; cents: number; bold?: boolean; negative?: boolean }[] = [
    { label: "Receita bruta", cents: dre.receitaBrutaCents, bold: true },
    { label: "(–) Impostos e deduções", cents: dre.impostosCents, negative: true },
    { label: "= Receita líquida", cents: dre.receitaLiquidaCents, bold: true },
    { label: "(–) Custos diretos de entrega", cents: dre.custosDiretosCents, negative: true },
    { label: "= Margem de contribuição", cents: dre.margemContribuicaoCents, bold: true },
    { label: "(–) Despesas operacionais", cents: dre.despesasOperacionaisCents, negative: true },
    { label: "= EBITDA gerencial", cents: dre.ebitdaGerencialCents, bold: true },
    { label: "(–) Despesas financeiras", cents: dre.despesasFinanceirasCents, negative: true },
    { label: "= Resultado", cents: dre.resultadoCents, bold: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">DRE gerencial</h1>
          <p className="text-sm text-[#667085]">
            {membership.agency.name} · por competência (seção 26.2 do manual).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/financeiro/dre?month=${monthParam(prevMonth.year, prevMonth.month)}`}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
          >
            ← {MONTH_LABELS[prevMonth.month]}
          </Link>
          <span className="text-sm font-semibold text-[#101828]">
            {MONTH_LABELS[month]} de {year}
          </span>
          <Link
            href={`/financeiro/dre?month=${monthParam(nextMonth.year, nextMonth.month)}`}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
          >
            {MONTH_LABELS[nextMonth.month]} →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-[#EEF0F3] first:border-t-0">
                <td className={`px-4 py-3 ${row.bold ? "font-semibold text-[#101828]" : "text-[#667085]"}`}>{row.label}</td>
                <td
                  className={`px-4 py-3 text-right ${row.bold ? "font-semibold text-[#101828]" : "text-[#667085]"} ${
                    row.negative && row.cents > 0 ? "text-[#B42318]" : ""
                  }`}
                >
                  {row.negative && row.cents > 0 ? "-" : ""}
                  {formatCents(row.cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-[#101828]">Como ler</h2>
        <p className="text-xs text-[#667085]">
          Tudo por <strong>competência</strong> (data de referência do lançamento, não de pagamento) — diferente do
          fluxo de caixa (<Link href="/financeiro/caixa" className="text-[#6847F5] hover:underline">Fluxo de caixa</Link>),
          que é por liquidação. Investimento e transferência entre contas não entram nesta conta, por decisão
          explícita do manual (não alteram o resultado do período). Lançamentos sem categoria são tratados pelo
          tipo (Receita → receita bruta, Despesa → despesa operacional).
        </p>
      </section>
    </div>
  );
}
