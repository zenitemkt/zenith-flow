"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/lib/dialogs";
import type { AutoSearch, ProspectingConfig } from "@/lib/prospecting/config";

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const FIELD = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

export function ProspectingSettingsForm({ config, hasToken, maxCombinations }: { config: ProspectingConfig; hasToken: boolean; maxCombinations: number }) {
  const router = useRouter();
  const [segments, setSegments] = useState(config.segments.join("\n"));
  const [cities, setCities] = useState(config.cities.join("\n"));
  const [maxPerSearch, setMaxPerSearch] = useState(config.maxPerSearch);
  const [token, setToken] = useState("");
  const [autoSearch, setAutoSearch] = useState<AutoSearch>(config.autoSearch);
  const [busy, setBusy] = useState(false);
  const combinations = lines(segments).length * lines(cities).length;

  async function save() {
    setBusy(true);
    const res = await fetch("/api/prospecting/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: { ...config, segments: lines(segments), cities: lines(cities), maxPerSearch, autoSearch }, apifyToken: token }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível salvar.", { title: "Não salvou" });
    setToken("");
    router.refresh();
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-[#344054]">
        Nichos (um por linha)
        <textarea rows={4} value={segments} onChange={(e) => setSegments(e.target.value)} placeholder={"clínica odontológica\nacademia\nimobiliária"} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[#344054]">
        Cidades (uma por linha)
        <textarea rows={4} value={cities} onChange={(e) => setCities(e.target.value)} placeholder={"Americana, SP\nSanta Bárbara d'Oeste, SP"} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[#344054]">
        Empresas por nicho e cidade
        <input type="number" min={5} max={100} value={maxPerSearch} onChange={(e) => setMaxPerSearch(Number(e.target.value))} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-[#344054]">
        Chave do Apify
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={hasToken ? "Já configurada — preencha só pra trocar" : "apify_api_..."} className={FIELD} />
        <span className="font-normal text-[#98A2B3]">apify.com → Settings → API &amp; Integrations</span>
      </label>
      <label className={`flex flex-col gap-1 text-xs font-medium text-[#344054] sm:col-span-2`}>
        Busca automática (todo dia às 7h, quando vence)
        <select value={autoSearch} onChange={(e) => setAutoSearch(e.target.value as AutoSearch)} className={FIELD}>
          <option value="off">Desligada: só quando eu clicar em Buscar</option>
          <option value="weekly">Semanal</option>
          <option value="daily">Diária</option>
        </select>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
        <p className="text-[11px] text-[#667085]">
          {combinations} combinação(ões) de nicho × cidade{combinations > maxCombinations ? ` — só as ${maxCombinations} primeiras entram em cada busca` : ""}. Cada combinação é uma execução cobrada no Apify.
        </p>
        <button type="button" disabled={busy} onClick={() => void save()} className="h-9 rounded-lg bg-[#FF2B00] px-4 text-xs font-semibold text-white disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
