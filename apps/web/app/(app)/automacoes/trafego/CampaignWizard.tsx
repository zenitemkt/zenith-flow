"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanAdSet, TrafficPlan } from "@/lib/traffic-campaigns";
import { NICHE_PRESETS } from "@/lib/traffic-niches";
import { CreativeEditor, CreativeUploader } from "./CreativeLibrary";

interface CreativeOption {
  id: string;
  name: string;
  fileName: string;
  kind: "IMAGE" | "VIDEO";
  status: string;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  linkUrl: string | null;
  callToAction: string | null;
}
const isReady = (c: CreativeOption) => Boolean(c.primaryText && c.headline);

interface Props {
  campaignId: string | null;
  initialPlan: TrafficPlan;
  defaultCities: string[];
  defaultButtonUrl: string;
  budgetCap: number | null;
  driveUserEmail: string | null;
  creatives: CreativeOption[];
}

const STEPS = ["Campanha", "Conjuntos", "Formulários", "Anúncios", "Revisão"];
const INPUT = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";
const LABEL = "flex flex-col gap-1 text-sm font-medium text-[#344054]";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function newAdSet(niche: string, cities: string[], buttonUrl: string): PlanAdSet {
  const preset = NICHE_PRESETS.find((p) => p.niche === niche);
  return {
    key: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    niche,
    cities: [...cities],
    radiusKm: 15,
    ageMin: 25,
    ageMax: 60,
    interests: [],
    dailyBudget: 30,
    form: {
      introTitle: preset?.introTitle ?? "",
      introText: preset?.introText ?? "",
      askCity: true,
      questions: preset ? preset.questions.map((q) => ({ label: q.label, options: [...q.options] })) : [],
      thankTitle: "Recebemos o seu cadastro",
      thankBody: "A equipe da Zenite vai falar com você pelo WhatsApp em breve.",
      buttonText: "Conhecer a Zenite",
      buttonUrl,
    },
    creativeIds: [],
  };
}

export function CampaignWizard({ campaignId: initialId, initialPlan, defaultCities, defaultButtonUrl, budgetCap, driveUserEmail, creatives: initialCreatives }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<TrafficPlan>(initialPlan);
  const [campaignId, setCampaignId] = useState(initialId);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [issues, setIssues] = useState<string[] | null>(null);
  const [submitLog, setSubmitLog] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [creatives, setCreatives] = useState<CreativeOption[]>(initialCreatives);
  const [editingCreative, setEditingCreative] = useState<CreativeOption | null>(null);

  /** Depois do envio pela etapa Anúncios: busca os criativos novos, põe na lista e já marca no conjunto. */
  async function attachUploaded(adsetKey: string, driveFileIds: string[]) {
    if (!driveFileIds.length) return;
    const res = await fetch("/api/ad-creatives/by-drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driveFileIds }) });
    const rows = ((await res.json().catch(() => null))?.creatives ?? []) as CreativeOption[];
    if (!rows.length) return;
    setCreatives((list) => [...rows.filter((row) => !list.some((c) => c.id === row.id)), ...list]);
    setPlan((p) => ({ ...p, adsets: p.adsets.map((a) => (a.key === adsetKey ? { ...a, creativeIds: Array.from(new Set([...a.creativeIds, ...rows.map((row) => row.id)])) } : a)) }));
    const missing = rows.find((row) => !isReady(row));
    if (missing) setEditingCreative(missing);
  }

  const update = (key: string, fn: (a: PlanAdSet) => PlanAdSet) => setPlan((p) => ({ ...p, adsets: p.adsets.map((a) => (a.key === key ? fn(a) : a)) }));
  const total = plan.adsets.reduce((n, a) => n + (Number(a.dailyBudget) || 0), 0);

  async function save(): Promise<string | null> {
    setSaving(true);
    setMessage(null);
    try {
      let id = campaignId;
      if (!id) {
        const res = await fetch("/api/traffic/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Não consegui salvar.");
        id = data.id as string;
        setCampaignId(id);
        window.history.replaceState(null, "", `/automacoes/trafego?aba=nova&campanha=${id}`);
      } else {
        const res = await fetch(`/api/traffic/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não consegui salvar.");
      }
      setMessage({ ok: true, text: "Rascunho salvo." });
      return id;
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Não consegui salvar." });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(next: number) {
    const id = await save();
    if (!id) return;
    setStep(next);
    if (next === 4) {
      const res = await fetch(`/api/traffic/campaigns/${id}/validate`, { method: "POST" });
      setIssues((await res.json().catch(() => null))?.issues ?? ["Não consegui conferir a campanha."]);
    }
  }

  async function submit() {
    const id = await save();
    if (!id) return;
    if (!window.confirm(`Subir "${plan.name}" para a Meta? Tudo vai pausado: ${plan.adsets.length} conjunto(s), R$ ${total.toFixed(2)}/dia quando ativar.`)) return;
    setSubmitting(true);
    setSubmitLog(["Enviando para a Meta…"]);
    for (let round = 0; round < 40; round++) {
      const res = await fetch(`/api/traffic/campaigns/${id}/submit`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { done?: boolean; message?: string; error?: string } | null;
      setSubmitLog((log) => [...log, data?.message ?? data?.error ?? "Erro desconhecido."]);
      if (!res.ok || data?.done) break;
      await sleep(data?.message?.includes("processando") ? 10_000 : 500);
    }
    setSubmitting(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" disabled={saving || submitting} onClick={() => goTo(i)} className={`rounded-full px-3 py-1 text-xs font-semibold ${step === i ? "bg-[#FF2B00] text-white" : "bg-white text-[#475467] ring-1 ring-[#E4E7EC]"}`}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5">
        {step === 0 && (
          <div className="flex max-w-2xl flex-col gap-3">
            <label className={LABEL}>
              Nome da campanha
              <input value={plan.name} onChange={(e) => setPlan((p) => ({ ...p, name: e.target.value }))} className={INPUT} />
            </label>
            <p className="text-sm text-[#475467]">Objetivo: <strong>Cadastros</strong>, com formulário instantâneo da Meta. A verba fica em cada conjunto (nicho), para cada um ter o próprio controle.</p>
            {budgetCap === null && <p className="rounded-lg bg-[#FFFAEB] px-3 py-2 text-sm text-[#B54708]">O teto de verba ainda não foi definido em Configurações. Dá para montar o rascunho, mas só sobe depois de definir.</p>}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[#344054]">Adicionar nicho:</span>
              {NICHE_PRESETS.map((p) => (
                <button key={p.niche} type="button" disabled={plan.adsets.some((a) => a.niche === p.niche)} onClick={() => setPlan((x) => ({ ...x, adsets: [...x.adsets, newAdSet(p.niche, defaultCities, defaultButtonUrl)] }))} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-40">
                  + {p.niche}
                </button>
              ))}
              <button type="button" onClick={() => setPlan((x) => ({ ...x, adsets: [...x.adsets, newAdSet("", defaultCities, defaultButtonUrl)] }))} className="rounded-lg border border-dashed border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054]">
                + Outro nicho
              </button>
            </div>
            {!plan.adsets.length && <p className="text-sm text-[#667085]">Nenhum conjunto ainda. Cada nicho vira um conjunto com verba e formulário próprios.</p>}
            {plan.adsets.map((a) => (
              <AdSetCard key={a.key} adset={a} defaultCities={defaultCities} onChange={(fn) => update(a.key, fn)} onRemove={() => setPlan((p) => ({ ...p, adsets: p.adsets.filter((x) => x.key !== a.key) }))} />
            ))}
            <p className={`text-sm font-medium ${budgetCap !== null && total > budgetCap ? "text-[#B42318]" : "text-[#344054]"}`}>
              Total: R$ {total.toFixed(2)}/dia (≈ R$ {(total * 30).toFixed(0)}/mês){budgetCap !== null ? ` · teto R$ ${budgetCap.toFixed(2)}/dia` : ""}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {!plan.adsets.length && <p className="text-sm text-[#667085]">Adicione conjuntos na etapa 2.</p>}
            {plan.adsets.map((a) => (
              <FormCard key={a.key} adset={a} onChange={(fn) => update(a.key, fn)} />
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            {!plan.adsets.length && <p className="text-sm text-[#667085]">Adicione conjuntos na etapa 2.</p>}
            {plan.adsets.map((a) => {
              const selected = a.creativeIds.map((id) => creatives.find((c) => c.id === id)).filter((c): c is CreativeOption => Boolean(c));
              const others = creatives.filter((c) => !a.creativeIds.includes(c.id));
              const toggle = (id: string) => update(a.key, (x) => ({ ...x, creativeIds: x.creativeIds.includes(id) ? x.creativeIds.filter((y) => y !== id) : [...x.creativeIds, id] }));
              return (
                <div key={a.key} className="rounded-xl border border-[#EEF0F3] p-4">
                  <p className="mb-3 text-sm font-semibold text-[#101828]">{a.niche || "Conjunto sem nome"} · {selected.length} anúncio(s)</p>
                  {driveUserEmail ? (
                    <CreativeUploader compact onDone={(ids) => attachUploaded(a.key, ids)} />
                  ) : (
                    <p className="rounded-lg bg-[#FFFAEB] px-3 py-2 text-sm text-[#B54708]">
                      Para subir arquivos aqui, conecte a conta Google na aba Criativos.{" "}
                      <a href="/api/admin/traffic-drive-oauth/start" className="font-semibold underline">Conectar agora</a>
                    </p>
                  )}
                  {selected.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {selected.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-[#FF2B00] bg-[#FFF4ED] p-2 text-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/ad-creatives/${c.id}/thumbnail`} alt="" className="h-12 w-12 rounded object-cover" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-[#101828]">{c.name}</span>
                            <button type="button" onClick={() => setEditingCreative(c)} className={`text-xs font-semibold ${isReady(c) ? "text-[#027A48]" : "text-[#B54708]"}`}>
                              {isReady(c) ? "Textos ok · editar" : "Preencher textos"}
                            </button>
                          </span>
                          <button type="button" onClick={() => toggle(c.id)} aria-label="Tirar do conjunto" className="text-[#B42318]">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {others.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[#475467]">Escolher da biblioteca ({others.length})</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {others.map((c) => (
                          <button key={c.id} type="button" onClick={() => toggle(c.id)} className="flex items-center gap-2 rounded-lg border border-[#EEF0F3] p-2 text-left text-sm hover:bg-[#F9FAFB]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/ad-creatives/${c.id}/thumbnail`} alt="" className="h-10 w-10 rounded object-cover" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-[#101828]">{c.name}</span>
                              <span className="text-xs text-[#667085]">{c.kind === "VIDEO" ? "Vídeo" : "Imagem"}{isReady(c) ? "" : " · faltam textos"}</span>
                            </span>
                            <span className="text-xs font-semibold text-[#FF2B00]">+ usar</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-[#667085]">Cada criativo do conjunto vira um anúncio. Os arquivos enviados aqui ficam salvos na pasta do Drive e na biblioteca.</p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-[#F9FAFB] p-4 text-sm">
              <p className="font-semibold text-[#101828]">{plan.name}</p>
              <ul className="mt-2 space-y-2">
                {plan.adsets.map((a) => (
                  <li key={a.key} className="border-l-2 border-[#FF2B00] pl-3">
                    <p className="font-medium text-[#101828]">{a.niche} · R$ {Number(a.dailyBudget).toFixed(2)}/dia</p>
                    <p className="text-xs text-[#667085]">
                      {a.cities.join(", ")} (raio {a.radiusKm} km) · {a.ageMin}–{a.ageMax} anos · {a.interests.length ? a.interests.map((i) => i.name).join(", ") : "sem interesses"}
                    </p>
                    <p className="text-xs text-[#667085]">Formulário: {a.form.introTitle || "(sem título)"} · {a.form.questions.length + (a.form.askCity ? 1 : 0) + 3} perguntas</p>
                    <p className="text-xs text-[#667085]">{a.creativeIds.length} anúncio(s): {a.creativeIds.map((id) => creatives.find((c) => c.id === id)?.name ?? "?").join(", ")}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-medium text-[#101828]">Total quando ativar: R$ {total.toFixed(2)}/dia (≈ R$ {(total * 30).toFixed(0)}/mês)</p>
            </div>
            {issues === null ? (
              <p className="text-sm text-[#667085]">Conferindo…</p>
            ) : issues.length ? (
              <ul className="rounded-lg bg-[#FEF3F2] p-3 text-sm text-[#B42318]">
                {issues.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-[#ECFDF3] px-3 py-2 text-sm text-[#027A48]">Tudo certo para subir. A campanha, os conjuntos e os anúncios vão pausados.</p>
            )}
            {submitLog.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg bg-[#101828] p-3 font-mono text-xs text-[#D0D5DD]">
                {submitLog.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            )}
            <div>
              <button type="button" disabled={submitting || saving || !issues || issues.length > 0} onClick={submit} className="rounded-lg bg-[#FF2B00] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {submitting ? "Subindo…" : "Aprovar e subir (pausado)"}
              </button>
            </div>
          </div>
        )}
      </div>

      {editingCreative && (
        <CreativeEditor
          creative={editingCreative}
          onClose={() => setEditingCreative(null)}
          onSaved={(values) => {
            setCreatives((list) => list.map((c) => (c.id === editingCreative.id ? { ...c, ...values } : c)));
            setEditingCreative(null);
          }}
        />
      )}
      {message && <p className={`text-sm ${message.ok ? "text-[#027A48]" : "text-[#B42318]"}`}>{message.text}</p>}
      <div className="flex flex-wrap gap-2">
        {step > 0 && (
          <button type="button" disabled={saving || submitting} onClick={() => goTo(step - 1)} className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054]">
            Voltar
          </button>
        )}
        <button type="button" disabled={saving || submitting} onClick={() => save()} className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054]">
          {saving ? "Salvando…" : "Salvar rascunho"}
        </button>
        {step < 4 && (
          <button type="button" disabled={saving || submitting} onClick={() => goTo(step + 1)} className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white">
            Próximo
          </button>
        )}
      </div>
    </section>
  );
}

function AdSetCard({ adset: a, defaultCities, onChange, onRemove }: { adset: PlanAdSet; defaultCities: string[]; onChange: (fn: (a: PlanAdSet) => PlanAdSet) => void; onRemove: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; audience?: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [extraCity, setExtraCity] = useState("");
  const preset = NICHE_PRESETS.find((p) => p.niche === a.niche);
  const allCities = Array.from(new Set([...defaultCities, ...a.cities]));

  async function search(term: string) {
    setQuery(term);
    if (term.trim().length < 2) return;
    setSearching(true);
    setError("");
    const res = await fetch(`/api/traffic/interests?q=${encodeURIComponent(term)}`);
    const data = await res.json().catch(() => null);
    setSearching(false);
    if (!res.ok) setError(data?.error ?? "Busca falhou.");
    else setResults(data.interests ?? []);
  }

  return (
    <div className="rounded-xl border border-[#EEF0F3] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <input value={a.niche} onChange={(e) => onChange((x) => ({ ...x, niche: e.target.value }))} placeholder="Nome do nicho" className={`${INPUT} max-w-sm font-semibold`} />
        <button type="button" onClick={onRemove} className="text-xs font-medium text-[#B42318]">Remover</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-[#344054]">Cidades</p>
          <div className="flex flex-wrap gap-1.5">
            {allCities.map((city) => {
              const on = a.cities.includes(city);
              return (
                <button key={city} type="button" onClick={() => onChange((x) => ({ ...x, cities: on ? x.cities.filter((c) => c !== city) : [...x.cities, city] }))} className={`rounded-full px-2.5 py-1 text-xs font-medium ${on ? "bg-[#101828] text-white" : "bg-[#F2F4F7] text-[#475467]"}`}>
                  {city}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={extraCity} onChange={(e) => setExtraCity(e.target.value)} placeholder="Outra cidade" className={INPUT} />
            <button type="button" onClick={() => { if (extraCity.trim()) onChange((x) => ({ ...x, cities: [...x.cities, extraCity.trim()] })); setExtraCity(""); }} className="shrink-0 rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium">Adicionar</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={LABEL}>Raio (km)<input type="number" value={a.radiusKm} onChange={(e) => onChange((x) => ({ ...x, radiusKm: Number(e.target.value) }))} className={INPUT} /></label>
          <label className={LABEL}>Verba diária (R$)<input type="number" value={a.dailyBudget} onChange={(e) => onChange((x) => ({ ...x, dailyBudget: Number(e.target.value) }))} className={INPUT} /></label>
          <label className={LABEL}>Idade mínima<input type="number" value={a.ageMin} onChange={(e) => onChange((x) => ({ ...x, ageMin: Number(e.target.value) }))} className={INPUT} /></label>
          <label className={LABEL}>Idade máxima<input type="number" value={a.ageMax} onChange={(e) => onChange((x) => ({ ...x, ageMax: Number(e.target.value) }))} className={INPUT} /></label>
        </div>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-[#344054]">Interesses do público</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {a.interests.map((i) => (
            <span key={i.id} className="flex items-center gap-1 rounded-full bg-[#FFF4ED] px-2.5 py-1 text-xs text-[#101828]">
              {i.name}
              <button type="button" onClick={() => onChange((x) => ({ ...x, interests: x.interests.filter((y) => y.id !== i.id) }))} className="text-[#B42318]">×</button>
            </span>
          ))}
          {!a.interests.length && <span className="text-xs text-[#667085]">Nenhum (a Meta mostra para qualquer pessoa nas cidades).</span>}
        </div>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(query); } }} placeholder="Buscar interesse na Meta" className={INPUT} />
          <button type="button" onClick={() => search(query)} className="shrink-0 rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium">{searching ? "Buscando…" : "Buscar"}</button>
        </div>
        {preset && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-[#667085]">
            Sugestões:
            {preset.interestTerms.map((t) => (
              <button key={t} type="button" onClick={() => search(t)} className="font-medium text-[#FF2B00]">{t}</button>
            ))}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-[#B42318]">{error}</p>}
        {results.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {results.map((r) => (
              <button key={r.id} type="button" disabled={a.interests.some((i) => i.id === r.id)} onClick={() => onChange((x) => ({ ...x, interests: [...x.interests, { id: r.id, name: r.name }] }))} className="rounded-full border border-[#D0D5DD] px-2.5 py-1 text-xs text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-40">
                + {r.name}{r.audience ? ` (${(r.audience / 1_000_000).toFixed(1)} mi)` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FormCard({ adset: a, onChange }: { adset: PlanAdSet; onChange: (fn: (a: PlanAdSet) => PlanAdSet) => void }) {
  const setForm = (patch: Partial<PlanAdSet["form"]>) => onChange((x) => ({ ...x, form: { ...x.form, ...patch } }));
  return (
    <div className="rounded-xl border border-[#EEF0F3] p-4">
      <p className="mb-3 text-sm font-semibold text-[#101828]">Formulário instantâneo · {a.niche || "Conjunto sem nome"}</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <label className={LABEL}>Título da abertura<input value={a.form.introTitle} maxLength={60} onChange={(e) => setForm({ introTitle: e.target.value })} className={INPUT} /></label>
          <label className={LABEL}>Texto da abertura<textarea value={a.form.introText} rows={3} onChange={(e) => setForm({ introText: e.target.value })} className={INPUT} /></label>
          <p className="text-xs text-[#667085]">Sempre perguntados (a Meta já preenche com os dados do Facebook): nome, telefone e e-mail.</p>
          <label className="flex items-center gap-2 text-sm text-[#344054]">
            <input type="checkbox" checked={a.form.askCity} onChange={(e) => setForm({ askCity: e.target.checked })} className="accent-[#FF2B00]" />
            Perguntar a cidade (opções: as cidades do conjunto)
          </label>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-[#344054]">Perguntas do nicho</p>
            {a.form.questions.map((q, i) => (
              <div key={i} className="rounded-lg bg-[#F9FAFB] p-2">
                <div className="flex gap-2">
                  <input value={q.label} onChange={(e) => setForm({ questions: a.form.questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Pergunta" className={INPUT} />
                  <button type="button" onClick={() => setForm({ questions: a.form.questions.filter((_, j) => j !== i) })} className="text-xs text-[#B42318]">Remover</button>
                </div>
                <input value={q.options.join("; ")} onChange={(e) => setForm({ questions: a.form.questions.map((x, j) => (j === i ? { ...x, options: e.target.value.split(";").map((o) => o.trim()).filter(Boolean) } : x)) })} placeholder="Opções separadas por ponto e vírgula (vazio = resposta escrita)" className={`${INPUT} mt-1.5 text-xs`} />
              </div>
            ))}
            {a.form.questions.length < 8 && (
              <button type="button" onClick={() => setForm({ questions: [...a.form.questions, { label: "", options: [] }] })} className="self-start text-xs font-semibold text-[#FF2B00]">+ Pergunta</button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={LABEL}>Título do agradecimento<input value={a.form.thankTitle} maxLength={60} onChange={(e) => setForm({ thankTitle: e.target.value })} className={INPUT} /></label>
            <label className={LABEL}>Texto do botão<input value={a.form.buttonText} maxLength={30} onChange={(e) => setForm({ buttonText: e.target.value })} className={INPUT} /></label>
          </div>
          <label className={LABEL}>Texto do agradecimento<textarea value={a.form.thankBody} rows={2} onChange={(e) => setForm({ thankBody: e.target.value })} className={INPUT} /></label>
          <label className={LABEL}>Link do botão<input value={a.form.buttonUrl} onChange={(e) => setForm({ buttonUrl: e.target.value })} className={INPUT} /></label>
        </div>
        <div className="rounded-2xl border border-[#E4E7EC] bg-[#F9FAFB] p-3 text-xs">
          <p className="mb-2 font-semibold text-[#667085]">Prévia</p>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-[#101828]">{a.form.introTitle || "Título da abertura"}</p>
            <p className="mt-1 whitespace-pre-line text-[#475467]">{a.form.introText || "Texto da abertura"}</p>
            <div className="mt-3 space-y-1.5">
              {["Nome completo", "Telefone", "E-mail", ...(a.form.askCity ? ["Em qual cidade fica a sua empresa?"] : []), ...a.form.questions.map((q) => q.label || "Pergunta")].map((q, i) => (
                <p key={i} className="rounded border border-[#EEF0F3] px-2 py-1 text-[#344054]">{q}</p>
              ))}
            </div>
            <p className="mt-3 rounded bg-[#1877F2] py-1.5 text-center font-semibold text-white">Enviar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
