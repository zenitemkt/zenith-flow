"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RefreshCw, Search, Star, Unlink } from "lucide-react";
import { confirmDialog } from "@/lib/dialogs";

interface Candidate { id: string; name: string; address: string }

export function GoogleReviewsPanel({ competitorId, initialQuery, place }: { competitorId: string; initialQuery: string; place: { id: string | null; name: string | null; address: string | null; rating: number | null; reviewCount: number | null; syncedAt: string | null; error: string | null } }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(place.error);

  async function search() {
    if (query.trim().length < 3) return;
    setBusy("search"); setError(null);
    const response = await fetch(`/api/competitors/google/search?q=${encodeURIComponent(query)}`);
    const body = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok) return setError(body?.error ?? "Não foi possível pesquisar.");
    setResults(body.places ?? []);
  }

  async function save(placeId?: string) {
    setBusy(placeId ?? "sync"); setError(null);
    const response = await fetch(`/api/competitors/${competitorId}/google`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(placeId ? { placeId } : {}) });
    const body = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok) return setError(body?.error ?? "Não foi possível atualizar.");
    setResults([]); router.refresh();
  }

  async function unlink() {
    if (!(await confirmDialog("Desvincular este estabelecimento e apagar o histórico diário das avaliações?", { title: "Desvincular Google", confirmLabel: "Desvincular", danger: true }))) return;
    setBusy("unlink");
    await fetch(`/api/competitors/${competitorId}/google`, { method: "DELETE" });
    setBusy(null); router.refresh();
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold text-[#101828]"><Star size={16} className="fill-[#FDB022] text-[#FDB022]" /> Avaliações no Google</h2><p className="mt-1 text-xs text-[#667085]">Nota pública e volume de avaliações. Atualiza no botão &quot;Atualizar&quot; (aqui ou nos diretos, acima) ou sozinho no dia 1, se passar 30 dias sem atualizar.</p></div>
        {place.id && <div className="text-right"><p className="text-3xl font-semibold text-[#101828]">{place.rating?.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? "—"}</p><p className="text-xs text-[#667085]">{place.reviewCount?.toLocaleString("pt-BR") ?? "—"} avaliações</p></div>}
      </div>
      {place.id ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F9FAFB] p-3">
          <div className="flex min-w-0 items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-[#FF2B00]" /><div><p className="text-sm font-medium text-[#101828]">{place.name}</p><p className="text-xs text-[#667085]">{place.address}</p>{place.syncedAt && <p className="mt-1 text-[11px] text-[#98A2B3]">Atualizado em {place.syncedAt}</p>}</div></div>
          <div className="flex gap-2"><button disabled={Boolean(busy)} onClick={() => void save()} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold"><RefreshCw size={14} />{busy === "sync" ? "Atualizando..." : "Atualizar"}</button><button aria-label="Desvincular Google" disabled={Boolean(busy)} onClick={() => void unlink()} className="flex h-9 items-center rounded-lg border border-[#D0D5DD] px-3 text-[#667085] hover:text-[#B42318]"><Unlink size={14} /></button></div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Nome da empresa e cidade" className="h-10 min-w-0 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]" /><button disabled={busy === "search" || query.trim().length < 3} onClick={() => void search()} className="flex h-10 items-center gap-2 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white disabled:opacity-60"><Search size={15} />{busy === "search" ? "Buscando..." : "Buscar"}</button></div>
          {results.length > 0 && <div className="mt-2 divide-y divide-[#EAECF0] rounded-lg border border-[#EAECF0]">{results.map((result) => <button key={result.id} disabled={Boolean(busy)} onClick={() => void save(result.id)} className="flex w-full items-start justify-between gap-4 px-3 py-3 text-left hover:bg-[#FFF4ED]"><span><span className="block text-sm font-medium text-[#101828]">{result.name}</span><span className="block text-xs text-[#667085]">{result.address}</span></span><span className="shrink-0 text-xs font-semibold text-[#FF2B00]">{busy === result.id ? "Vinculando..." : "Vincular"}</span></button>)}</div>}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">{error}</p>}
    </section>
  );
}

export function GoogleReviewsComparison({ profiles, days }: { profiles: { id: string; username: string; isOwn: boolean; rating: number | null; reviewCount: number | null; firstReviewCount: number | null }[]; days: number }) {
  const linked = profiles.filter((profile) => profile.rating !== null || profile.reviewCount !== null).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  if (linked.length === 0) return null;
  return <section className="rounded-xl border border-[#E4E7EC] bg-white p-4"><div className="mb-3"><h2 className="text-base font-semibold text-[#101828]">Reputação no Google</h2><p className="text-xs text-[#667085]">Nota, volume e novas avaliações nos últimos {days} dias.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px]"><thead><tr className="text-left text-xs text-[#667085]"><th className="pb-2 font-medium">Posição</th><th className="pb-2 font-medium">Perfil</th><th className="pb-2 font-medium">Nota</th><th className="pb-2 font-medium">Avaliações</th><th className="pb-2 text-right font-medium">Novas no período</th></tr></thead><tbody>{linked.map((profile, index) => { const growth = profile.firstReviewCount === null || profile.reviewCount === null ? null : profile.reviewCount - profile.firstReviewCount; return <tr key={profile.id} className={`border-t border-[#F2F4F7] text-sm ${profile.isOwn ? "bg-[#FFF4ED]" : ""}`}><td className="py-3 font-semibold text-[#101828]">{index + 1}º</td><td className="py-3 text-[#344054]">@{profile.username}{profile.isOwn && <span className="ml-2 rounded-full bg-[#FF2B00] px-2 py-0.5 text-[10px] font-semibold text-white">Cliente</span>}</td><td className="py-3 font-semibold text-[#101828]">{profile.rating?.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) ?? "—"}</td><td className="py-3 text-[#344054]">{profile.reviewCount?.toLocaleString("pt-BR") ?? "—"}</td><td className={`py-3 text-right font-semibold ${growth !== null && growth > 0 ? "text-[#027A48]" : "text-[#667085]"}`}>{growth === null ? "—" : `${growth >= 0 ? "+" : ""}${growth}`}</td></tr>; })}</tbody></table></div></section>;
}
