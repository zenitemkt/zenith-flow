"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";
import { alertDialog } from "@/lib/dialogs";
import type { MonthlyCompetitorReportContent } from "@/lib/competitor-reports";
import { CompetitorReportView } from "@/app/_components/CompetitorReportView";

export function CompetitorMonthlyReports({ clientId, targetMonth, targetLabel, reports }: { clientId: string; targetMonth: string; targetLabel: string; reports: { id: string; monthLabel: string; generatedLabel: string; content: MonthlyCompetitorReportContent }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(reports[0]?.id ?? null);
  const current = reports.find((report) => report.id === selected) ?? reports[0] ?? null;
  async function generate() {
    setBusy(true);
    const response = await fetch("/api/competitor-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, month: targetMonth }) });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return alertDialog(body?.error ?? "Não foi possível gerar o relatório.", { title: "Relatório não gerado" });
    router.refresh();
  }
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><FileText size={16} className="text-[#FF2B00]" aria-hidden /><h2 className="text-sm font-semibold text-[#101828]">Relatório mensal de concorrência</h2></div><p className="mt-1 text-xs text-[#667085]">Fechamento do mês com evidências, posição do cliente e cinco ações recomendadas.</p></div>
        <button type="button" disabled={busy} onClick={() => void generate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#101828] px-3 text-xs font-semibold text-white disabled:opacity-60"><Sparkles size={14} aria-hidden />{busy ? "Gerando (até 1 min)..." : reports.some((report) => report.monthLabel.toLowerCase() === targetLabel.toLowerCase()) ? `Refazer ${targetLabel}` : `Gerar ${targetLabel}`}</button>
      </div>
      {reports.length === 0 ? <p className="mt-4 rounded-lg bg-[#F9FAFB] px-4 py-5 text-sm text-[#667085]">Nenhum relatório fechado ainda. O primeiro pode ser gerado agora e os próximos serão criados automaticamente no início de cada mês.</p> : <><div className="mt-4 flex flex-wrap gap-2">{reports.map((report) => <button key={report.id} type="button" onClick={() => setSelected(report.id)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${current?.id === report.id ? "bg-[#101828] text-white" : "bg-[#F2F4F7] text-[#475467]"}`}>{report.monthLabel}</button>)}</div>{current && <div className="mt-6 border-t border-[#EAECF0] pt-6"><p className="mb-5 text-xs text-[#98A2B3]">Gerado em {current.generatedLabel}</p><CompetitorReportView report={current.content} /></div>}</>}
    </section>
  );
}
