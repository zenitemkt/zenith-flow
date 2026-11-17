"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe2, RotateCcw, Save } from "lucide-react";

export function CompetitorWebsiteEditor({ competitorId, instagramWebsite, websiteOverride }: { competitorId: string; instagramWebsite: string | null; websiteOverride: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(websiteOverride ?? instagramWebsite ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (next: string | null) => startTransition(async () => {
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/competitors/${competitorId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteOverride: next }) });
    const body = await response.json().catch(() => null) as { error?: string; website?: string | null } | null;
    if (!response.ok) return setError(body?.error ?? "Não foi possível salvar o site.");
    setValue(body?.website ?? instagramWebsite ?? "");
    setSaved(true);
    router.refresh();
  });

  return (
    <div className="mt-4 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF4ED] text-[#FF2B00]"><Globe2 size={17} /></span>
        <div className="min-w-[180px] flex-1">
          <label htmlFor={`website-${competitorId}`} className="text-xs font-semibold text-[#344054]">Site oficial</label>
          <input id={`website-${competitorId}`} value={value} onChange={(event) => { setValue(event.target.value); setSaved(false); }} placeholder="https://empresa.com.br" className="mt-1 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none transition focus:border-[#FF2B00] focus:ring-2 focus:ring-[#FF2B00]/15" />
        </div>
        <button type="button" disabled={pending || !value.trim()} onClick={() => update(value)} className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#FF2B00] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#D92D20] disabled:cursor-not-allowed disabled:opacity-50"><Save size={14} />{pending ? "Salvando..." : "Salvar site"}</button>
        {websiteOverride && <button type="button" disabled={pending} onClick={() => update(null)} className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-medium text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-50"><RotateCcw size={14} />Usar link da bio</button>}
      </div>
      <div className="mt-2 pl-10 text-[11px] text-[#667085]">
        {websiteOverride ? <p>Site definido manualmente e usado nas medições.{instagramWebsite && <> O link capturado da bio continua guardado: <a href={instagramWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#FF2B00] hover:underline">abrir link da bio <ExternalLink size={10} /></a>.</>}</p> : <p>Usando o link capturado da bio do Instagram. Se ele for Linktree, WhatsApp ou outro agregador, substitua pelo site real.</p>}
        {saved && <p className="mt-1 font-medium text-[#027A48]">Site salvo. A próxima medição usará este endereço.</p>}
        {error && <p className="mt-1 font-medium text-[#B42318]">{error}</p>}
      </div>
    </div>
  );
}
