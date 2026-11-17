"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Lightbulb, Loader2, Sparkles } from "lucide-react";
import type { CompetitorContentIdea } from "@/lib/competitor-content-ideas";

function suggestedDate(index: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + index * 3 + 1);
  return date.toISOString().slice(0, 10);
}

export function CompetitorContentIdeas({ clientId, clientName, days }: { clientId: string; clientName: string; days: number }) {
  const [ideas, setIdeas] = useState<CompetitorContentIdea[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const [created, setCreated] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const generatedCount = useMemo(() => Object.keys(created).length, [created]);

  async function generate() {
    setGenerating(true);
    setError(null);
    const response = await fetch("/api/competitors/content-ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, days }) });
    const body = await response.json().catch(() => null) as { ideas?: CompetitorContentIdea[]; error?: string } | null;
    setGenerating(false);
    if (!response.ok || !body?.ideas) return setError(body?.error ?? "Não foi possível gerar as pautas.");
    setIdeas(body.ideas);
    setDates(body.ideas.map((_, index) => suggestedDate(index)));
    setCreated({});
  }

  async function sendToCalendar(idea: CompetitorContentIdea, index: number) {
    setSending(index);
    setError(null);
    const scheduledDate = dates[index] ? new Date(`${dates[index]}T12:00:00`).toISOString() : null;
    const response = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        title: idea.title,
        channel: "INSTAGRAM",
        format: idea.format,
        caption: `${idea.hook}\n\n${idea.captionOpening}`,
        description: `${idea.rationale}${idea.sources.length ? `\n\nReferências analisadas: ${idea.sources.join(", ")}` : ""}`,
        campaign: "Sugestão da análise de concorrentes",
        scheduledDate,
      }),
    });
    const body = await response.json().catch(() => null) as { id?: string; error?: string } | null;
    setSending(null);
    if (!response.ok || !body?.id) return setError(body?.error ?? "Não foi possível enviar a pauta ao calendário.");
    setCreated((current) => ({ ...current, [index]: body.id! }));
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF4ED] text-[#FF2B00]"><Lightbulb size={19} /></span>
          <div><h2 className="text-sm font-semibold text-[#101828]">Sugestões de pauta</h2><p className="max-w-2xl text-xs text-[#667085]">Cruza o que funcionou nos outros perfis com o que {clientName} ainda não publicou. As ideias entram no calendário como rascunho.</p></div>
        </div>
        <button type="button" disabled={generating} onClick={() => void generate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#101828] px-3 text-xs font-semibold text-white disabled:opacity-60">{generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{generating ? "Gerando 10 pautas..." : ideas.length ? "Gerar novas ideias" : "Gerar ideias de conteúdo"}</button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs font-medium text-[#B42318]">{error}</p>}
      {ideas.length === 0 && !generating && <div className="mt-4 border-t border-[#EAECF0] pt-4"><p className="text-sm text-[#667085]">A IA analisará os últimos {days} dias. Cadastre o perfil do cliente e mantenha os concorrentes atualizados para obter pautas mais específicas.</p></div>}
      {generating && <div className="mt-4 border-t border-[#EAECF0] pt-5"><div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#FF2B00]" /></div><p className="mt-2 text-xs text-[#667085]">Lendo temas, formatos e ganchos vencedores. Isso pode levar até um minuto.</p></div>}

      {ideas.length > 0 && <div className="mt-4 divide-y divide-[#EAECF0] border-t border-[#EAECF0]">
        {ideas.map((idea, index) => {
          const contentId = created[index];
          return <article key={`${idea.title}-${index}`} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_230px]">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#101828] text-xs font-semibold text-white">{index + 1}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#101828]">{idea.title}</h3><span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-medium text-[#475467]">{idea.format}</span></div>
                <blockquote className="mt-2 border-l-2 border-[#FF2B00] pl-3 text-sm font-medium text-[#344054]">“{idea.hook}”</blockquote>
                <p className="mt-2 text-sm leading-6 text-[#475467]">{idea.captionOpening}</p>
                <p className="mt-2 text-xs text-[#667085]"><span className="font-semibold text-[#344054]">Por que testar:</span> {idea.rationale}</p>
                {idea.sources.length > 0 && <p className="mt-1 text-[11px] text-[#98A2B3]">Base: {idea.sources.join(", ")}</p>}
              </div>
            </div>
            <div className="flex flex-col justify-center gap-2 rounded-lg bg-[#F9FAFB] p-3">
              <label htmlFor={`idea-date-${index}`} className="text-[11px] font-medium text-[#667085]">Data sugerida</label>
              <input id={`idea-date-${index}`} type="date" value={dates[index] ?? ""} onChange={(event) => setDates((current) => current.map((date, itemIndex) => itemIndex === index ? event.target.value : date))} disabled={Boolean(contentId)} className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-2 text-sm text-[#344054] outline-none focus:border-[#FF2B00] disabled:opacity-60" />
              {contentId ? <Link href={`/conteudo/${contentId}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#ECFDF3] px-3 text-xs font-semibold text-[#027A48]"><Check size={14} />Abrir rascunho</Link> : <button type="button" disabled={sending !== null} onClick={() => void sendToCalendar(idea, index)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#FF2B00] px-3 text-xs font-semibold text-white disabled:opacity-60">{sending === index ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}{sending === index ? "Enviando..." : "Enviar ao calendário"}</button>}
            </div>
          </article>;
        })}
        {generatedCount > 0 && <p className="pt-4 text-xs font-medium text-[#027A48]">{generatedCount} de 10 pautas enviadas ao calendário.</p>}
      </div>}
    </section>
  );
}
