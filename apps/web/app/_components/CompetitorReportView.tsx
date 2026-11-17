import type { MonthlyCompetitorReportContent } from "@/lib/competitor-reports";

export function CompetitorReportView({ report, dark = false }: { report: MonthlyCompetitorReportContent; dark?: boolean }) {
  const primary = dark ? "text-[#F5F2EE]" : "text-[#101828]";
  const muted = dark ? "text-[#A3A5B2]" : "text-[#667085]";
  const panel = dark ? "border-white/[0.08] bg-white/[0.025]" : "border-[#EAECF0] bg-[#F9FAFB]";
  return (
    <article className="space-y-8">
      <header className="max-w-3xl">
        <h2 className={`font-display text-2xl font-semibold tracking-[-0.025em] ${primary}`}>{report.title}</h2>
        <p className={`mt-3 text-[15px] leading-7 ${muted}`}>{report.summary}</p>
      </header>

      <section className={`rounded-2xl border p-5 ${panel}`}>
        <h3 className={`text-sm font-semibold ${primary}`}>O que mudou no mercado</h3>
        <ul className={`mt-3 space-y-2 text-sm leading-6 ${muted}`}>{report.marketChanges.map((item) => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF5A1E]" />{item}</li>)}</ul>
      </section>

      <section>
        <h3 className={`text-sm font-semibold ${primary}`}>O que funcionou para os concorrentes</h3>
        <div className="mt-3 divide-y divide-current/10 border-y border-current/10">
          {report.competitorWins.map((item) => <div key={`${item.title}-${item.evidence}`} className="grid gap-2 py-4 md:grid-cols-[180px_1fr_1fr]"><p className={`text-sm font-semibold ${primary}`}>{item.title}</p><p className={`text-sm leading-6 ${muted}`}><span className={`font-medium ${primary}`}>Evidência: </span>{item.evidence}</p><p className={`text-sm leading-6 ${muted}`}><span className={`font-medium ${primary}`}>Leitura: </span>{item.implication}</p></div>)}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className={`rounded-2xl border p-5 ${panel}`}><h3 className="text-sm font-semibold text-[#12B76A]">Onde o cliente está à frente</h3><ul className={`mt-3 space-y-2 text-sm leading-6 ${muted}`}>{report.clientPosition.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></div>
        <div className={`rounded-2xl border p-5 ${panel}`}><h3 className="text-sm font-semibold text-[#F79009]">Onde existe espaço para avançar</h3><ul className={`mt-3 space-y-2 text-sm leading-6 ${muted}`}>{report.clientPosition.gaps.map((item) => <li key={item}>• {item}</li>)}</ul></div>
      </section>

      <section>
        <h3 className={`text-sm font-semibold ${primary}`}>Plano para o próximo mês</h3>
        <ol className="mt-4 space-y-3">{report.actions.map((action, index) => <li key={action.title} className={`grid gap-3 rounded-2xl border p-5 sm:grid-cols-[42px_1fr] ${panel}`}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF2B00] font-display text-sm font-semibold text-white">{index + 1}</span><div><h4 className={`text-[15px] font-semibold ${primary}`}>{action.title}</h4><p className={`mt-1 text-sm leading-6 ${muted}`}>{action.why}</p><p className={`mt-2 text-sm leading-6 ${primary}`}><span className="font-semibold">Como executar: </span>{action.execution}</p><p className={`mt-1 text-xs ${muted}`}><span className="font-semibold">Acompanhar: </span>{action.metric}</p></div></li>)}</ol>
      </section>

      <footer className={`border-t pt-4 text-xs leading-5 ${dark ? "border-white/10 text-[#8B8D9A]" : "border-[#EAECF0] text-[#98A2B3]"}`}>
        <p>Fontes: {report.sources.profiles} perfis, {report.sources.clientPosts} posts do cliente, {report.sources.competitorPosts} posts de concorrentes e {report.sources.ads} anúncios capturados.</p>
        {report.limitations.length > 0 && <p className="mt-1">Limites: {report.limitations.join(" ")}</p>}
      </footer>
    </article>
  );
}
