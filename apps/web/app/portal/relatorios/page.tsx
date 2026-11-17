import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requirePortalContext } from "@/lib/portal";
import { monthLabel, parseMonthlyCompetitorReport } from "@/lib/competitor-reports";
import { CompetitorReportView } from "@/app/_components/CompetitorReportView";

export const dynamic = "force-dynamic";

export default async function PortalReportsPage({ searchParams }: { searchParams: { relatorio?: string } }) {
  const { membership, client } = await requirePortalContext();
  if (membership.role !== "CLIENT_ADMIN") redirect("/portal");
  const rows = await prisma.competitorReport.findMany({ where: { clientId: client.id }, orderBy: { month: "desc" }, take: 24 });
  const reports = rows.flatMap((row) => {
    try { return [{ ...row, parsed: parseMonthlyCompetitorReport(row.content) }]; } catch { return []; }
  });
  const selected = reports.find((report) => report.id === searchParams.relatorio) ?? reports[0] ?? null;
  return (
    <div className="space-y-10">
      <header className="max-w-3xl"><p className="text-sm text-[#FF8A5C]">Inteligência competitiva</p><h1 className="mt-2 font-display text-[clamp(2.2rem,5vw,3.5rem)] font-semibold leading-none tracking-[-0.035em] text-[#F5F2EE]">Relatórios mensais</h1><p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#A3A5B2]">Uma leitura objetiva do mercado, do posicionamento da sua marca e das prioridades recomendadas para o próximo mês.</p></header>
      {reports.length === 0 ? <section className="rounded-[22px] border border-dashed border-white/10 px-6 py-10"><h2 className="font-display text-lg font-semibold">O primeiro relatório ainda está sendo preparado</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#8B8D9A]">Quando a equipe fechar a primeira análise mensal de concorrência, ela ficará disponível aqui e continuará guardada para consulta.</p></section> : <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]"><aside><p className="mb-3 text-xs font-medium text-[#8B8D9A]">Histórico</p><nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">{reports.map((report) => <a key={report.id} href={`/portal/relatorios?relatorio=${report.id}`} aria-current={selected?.id === report.id ? "page" : undefined} className={`shrink-0 rounded-xl px-3 py-2.5 text-sm transition ${selected?.id === report.id ? "bg-white/[0.08] text-[#F5F2EE]" : "text-[#8B8D9A] hover:bg-white/[0.04] hover:text-white"}`}><span className="block font-medium capitalize">{monthLabel(report.month)}</span><span className="mt-0.5 block text-[11px] opacity-70">gerado em {report.generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></a>)}</nav></aside>{selected && <section className="min-w-0 rounded-[24px] border border-white/[0.08] bg-[#0E0F15]/80 p-5 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.8)] sm:p-8"><p className="mb-6 text-xs capitalize text-[#8B8D9A]">{monthLabel(selected.month)}</p><CompetitorReportView report={selected.parsed} dark /></section>}</div>}
    </div>
  );
}
