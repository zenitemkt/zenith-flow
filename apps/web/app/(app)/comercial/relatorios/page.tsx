import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { resolvePipelinePeriod } from "@/lib/pipeline-period";
import { buildCommercialReport, type ReportRow } from "@/lib/commercial-reports";
import { formatOpportunityValue } from "@/lib/pipeline";
import { ReportsFilter } from "./ReportsFilter";

interface SearchParams { period?: string; year?: string; month?: string; from?: string; to?: string; origin?: string; campaign?: string; service?: string }

function formatHours(value: number | null) {
  if (value === null) return "Sem dados";
  if (value < 24) return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
  return `${(value / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

function ReportTable({ title, rows, showAbandoned = false, showVisitors = true }: { title: string; rows: ReportRow[]; showAbandoned?: boolean; showVisitors?: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <h2 className="px-4 py-3 text-sm font-semibold text-[#101828]">{title}</h2>
      {rows.length === 0 ? <p className="border-t border-[#EEF0F3] p-6 text-center text-sm text-[#667085]">Nenhum dado neste período.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#F9FAFB] text-xs uppercase text-[#667085]"><tr><th className="px-4 py-3">Nome</th>{showVisitors && <th className="px-4 py-3">Visitantes</th>}<th className="px-4 py-3">Leads</th><th className="px-4 py-3">Qualificados</th><th className="px-4 py-3">Propostas</th><th className="px-4 py-3">Vendas</th><th className="px-4 py-3">Receita</th>{showAbandoned && <th className="px-4 py-3">Abandonos</th>}<th className="px-4 py-3">Conversão</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label} className="border-t border-[#EEF0F3]"><td className="px-4 py-3 font-medium text-[#101828]">{row.label}</td>{showVisitors && <td className="px-4 py-3 text-[#475467]">{row.visitors}</td>}<td className="px-4 py-3 text-[#475467]">{row.leads}</td><td className="px-4 py-3 text-[#475467]">{row.qualified}</td><td className="px-4 py-3 text-[#475467]">{row.proposals}</td><td className="px-4 py-3 text-[#475467]">{row.sales}</td><td className="px-4 py-3 font-semibold text-[#027A48]">{formatOpportunityValue(row.revenueCents)}</td>{showAbandoned && <td className="px-4 py-3 text-[#B54708]">{row.abandoned}</td>}<td className="px-4 py-3 text-[#475467]">{row.conversionRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}

export default async function CommercialReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const selectedPeriod = resolvePipelinePeriod({ ...searchParams, period: searchParams.period ?? "last30" });
  const report = await buildCommercialReport(membership.agencyId, { range: selectedPeriod.createdAt, origin: searchParams.origin, campaign: searchParams.campaign, service: searchParams.service });
  const cards = [[report.totals.visitors, "visitantes"], [report.totals.leads, "leads"], [report.totals.qualified, "qualificados"], [report.totals.proposals, "propostas"], [report.totals.sales, "vendas"], [formatOpportunityValue(report.totals.revenueCents), "valor ganho"], [`${report.totals.conversionRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, "conversão"]];
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-lg font-semibold text-[#101828]">Relatórios comerciais</h1><p className="text-sm text-[#667085]">Do primeiro acesso à receita ganha — {selectedPeriod.label.toLocaleLowerCase()}.</p></div>
      <ReportsFilter initial={{ period: selectedPeriod.period, year: searchParams.year, month: searchParams.month, from: searchParams.from, to: searchParams.to, origin: searchParams.origin, campaign: searchParams.campaign, service: searchParams.service }} origins={report.origins} campaigns={report.campaigns} services={report.serviceOptions} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{cards.map(([value, label]) => <div key={label} className="rounded-xl border border-[#E4E7EC] bg-white p-3"><p className="text-xl font-semibold text-[#101828]">{value}</p><p className="text-xs text-[#667085]">{label}</p></div>)}</section>
      <section className="grid gap-3 md:grid-cols-4">{[[formatHours(report.timing.firstContactHours), "até primeiro atendimento"], [formatHours(report.timing.qualificationHours), "até qualificação"], [formatHours(report.timing.proposalHours), "até proposta"], [formatHours(report.timing.saleHours), "até venda"]].map(([value, label]) => <div key={label} className="rounded-xl border border-[#E4E7EC] bg-white p-4"><p className="text-lg font-semibold text-[#101828]">{value}</p><p className="text-xs text-[#667085]">tempo médio {label}</p></div>)}</section>
      <ReportTable title="Ranking por origem e campanha" rows={report.channels} />
      <ReportTable title="Resultados por serviço procurado" rows={report.services} showAbandoned showVisitors={false} />
      <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white"><div className="px-4 py-3"><h2 className="text-sm font-semibold text-[#101828]">Primeira origem × última origem</h2><p className="text-xs text-[#667085]">Quem apresentou o lead e qual canal recebeu o último crédito antes da conversão.</p></div>{report.firstVsLast.length === 0 ? <p className="border-t border-[#EEF0F3] p-6 text-center text-sm text-[#667085]">Nenhuma jornada identificada.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#F9FAFB] text-xs uppercase text-[#667085]"><tr><th className="px-4 py-3">Primeira origem</th><th className="px-4 py-3">Última origem</th><th className="px-4 py-3">Leads</th><th className="px-4 py-3">Vendas</th><th className="px-4 py-3">Receita</th></tr></thead><tbody>{report.firstVsLast.map((row) => <tr key={`${row.first}-${row.last}`} className="border-t border-[#EEF0F3]"><td className="px-4 py-3">{row.first}</td><td className="px-4 py-3">{row.last}</td><td className="px-4 py-3">{row.leads}</td><td className="px-4 py-3">{row.sales}</td><td className="px-4 py-3 font-semibold text-[#027A48]">{formatOpportunityValue(row.revenueCents)}</td></tr>)}</tbody></table></div>}</section>
    </div>
  );
}
