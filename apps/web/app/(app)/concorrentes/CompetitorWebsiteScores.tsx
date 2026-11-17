import { ExternalLink, Gauge } from "lucide-react";

interface WebsiteProfile {
  id: string;
  username: string;
  isOwn: boolean;
  website: string | null;
  score: number | null;
  measuredAt: string | null;
  error: string | null;
}

const tone = (score: number) => score >= 90 ? { bar: "bg-[#12B76A]", text: "text-[#027A48]", label: "Rápido" } : score >= 50 ? { bar: "bg-[#F79009]", text: "text-[#B54708]", label: "Precisa melhorar" } : { bar: "bg-[#F04438]", text: "text-[#B42318]", label: "Lento" };

export function CompetitorWebsiteScores({ profiles }: { profiles: WebsiteProfile[] }) {
  const sorted = profiles.filter((profile) => profile.website).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  if (sorted.length === 0) return null;
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-4 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF4ED] text-[#FF2B00]"><Gauge size={19} /></span><div><h2 className="text-sm font-semibold text-[#101828]">Velocidade dos sites</h2><p className="text-xs text-[#667085]">Nota mobile do Google PageSpeed. Atualiza diariamente e também pelo botão “Medir site”.</p></div></div>
      <div className="flex flex-col divide-y divide-[#F2F4F7]">
        {sorted.map((profile) => {
          const colors = profile.score === null ? null : tone(profile.score);
          return <div key={profile.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(150px,1fr)_minmax(220px,2fr)_150px] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#101828]">@{profile.username}{profile.isOwn && <span className="ml-1.5 rounded-full bg-[#EFF8FF] px-1.5 py-0.5 text-[10px] font-medium text-[#175CD3]">Cliente</span>}</p><a href={profile.website!} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[11px] text-[#667085] hover:text-[#FF2B00]"><span className="truncate">{profile.website}</span><ExternalLink size={11} className="shrink-0" /></a></div>{profile.score === null ? <p className="text-sm text-[#98A2B3] sm:col-span-2">{profile.error ?? "Ainda não medido."}</p> : <><div><div className="h-2 overflow-hidden rounded-full bg-[#F2F4F7]"><div className={`h-full rounded-full ${colors!.bar}`} style={{ width: `${profile.score}%` }} /></div><p className="mt-1 text-[11px] text-[#98A2B3]">{profile.measuredAt ? `Medido em ${profile.measuredAt}` : "Medição recente"}</p></div><div className="sm:text-right"><span className={`text-2xl font-semibold ${colors!.text}`}>{profile.score}</span><span className="text-xs text-[#98A2B3]">/100</span><p className={`text-[11px] font-medium ${colors!.text}`}>{colors!.label}</p></div></>}</div>;
        })}
      </div>
      <p className="mt-4 border-t border-[#F2F4F7] pt-3 text-[11px] text-[#98A2B3]">Teste de laboratório em celular simulado. A nota pode variar entre medições conforme o servidor e a rede.</p>
    </section>
  );
}
