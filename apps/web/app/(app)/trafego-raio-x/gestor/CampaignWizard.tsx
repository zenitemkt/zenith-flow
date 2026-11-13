"use client";

import { confirmDialog } from "@/lib/dialogs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanAdSet, TrafficPlan } from "@/lib/traffic-campaigns";
import { NICHE_PRESETS, zeniteFormTemplate } from "@/lib/traffic-niches";
import { adSetName } from "@/lib/traffic-naming";
import { creativeRole } from "@/lib/creative-pairing";
import { DEFAULT_URL_TAGS, splitLines, splitPrimaryTexts } from "@/lib/copy-split";
import { adCopyKey, adsForAdSet, copyForAd, creativeGroup, emptyCopy, planDailyTotal, type PlanCopy } from "@/lib/traffic-copy";
import { CreativeEditor, CreativeUploader } from "./CreativeLibrary";

interface CreativeOption {
  id: string;
  name: string;
  fileName: string;
  kind: "IMAGE" | "VIDEO";
  width?: number | null;
  height?: number | null;
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
  savedUrlTags: string | null;
  creatives: CreativeOption[];
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: "ativa", PAUSED: "pausada", ARCHIVED: "arquivada", IN_PROCESS: "em processamento", WITH_ISSUES: "com problemas" };
const STEPS = ["Campanha", "Conjuntos", "Formulário ou site", "Anúncios", "Revisão"];
const INPUT = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";
const LABEL = "flex flex-col gap-1 text-sm font-medium text-[#344054]";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function newAdSet(niche: string, cities: string[], buttonUrl: string): PlanAdSet {
  return {
    key: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    niche,
    cities: [...cities],
    geoMode: "CITY",
    radiusKm: 17,
    temperature: "FRIO",
    customAudiences: [],
    advantage: true,
    ageMin: 25,
    ageMax: 55,
    gender: 0,
    interests: [],
    dailyBudget: 30,
    form: zeniteFormTemplate(niche),
    destinationUrl: buttonUrl,
    creativeIds: [],
  };
}

export function CampaignWizard({ campaignId: initialId, initialPlan, defaultCities, defaultButtonUrl, budgetCap, driveUserEmail, savedUrlTags, creatives: initialCreatives }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<TrafficPlan>(initialPlan);
  const [campaignId, setCampaignId] = useState(initialId);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [issues, setIssues] = useState<string[] | null>(null);
  const [submitLog, setSubmitLog] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!submitting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [submitting]);
  const [creatives, setCreatives] = useState<CreativeOption[]>(initialCreatives);
  const [editingCreative, setEditingCreative] = useState<CreativeOption | null>(null);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<{ name: string; status: string } | null>(null);
  const [keepUrlTags, setKeepUrlTags] = useState(Boolean(savedUrlTags));
  const [pasteTexts, setPasteTexts] = useState("");
  const [pasteHeadlines, setPasteHeadlines] = useState("");
  const [pasteDescriptions, setPasteDescriptions] = useState("");
  const [copyTab, setCopyTab] = useState(0);
  const groupCount = plan.splitCopy ? plan.copyGroups.length + 1 : 1;
  const tab = Math.min(copyTab, groupCount - 1);
  const activeCopy: PlanCopy = tab === 0 ? plan.copy : plan.copyGroups[tab - 1] ?? emptyCopy();
  const setCopy = (patch: Partial<PlanCopy>) =>
    setPlan((p) => (tab === 0 ? { ...p, copy: { ...p.copy, ...patch } } : { ...p, copyGroups: p.copyGroups.map((g, i) => (i === tab - 1 ? { ...g, ...patch } : g)) }));
  const hasCopy = (c: PlanCopy) => c.primaryTexts.length > 0 && c.headlines.length > 0;
  useEffect(() => {
    fetch("/api/traffic/next-code?objective=OUTCOME_LEADS")
      .then((res) => res.json())
      .then((data) => {
        setNextCode(typeof data?.code === "string" ? data.code : null);
        setLastUsed(data?.last && typeof data.last.name === "string" ? data.last : null);
      })
      .catch(() => setNextCode(null));
  }, []);
  const codeMatch = plan.name.match(/^\s*\[([A-Z]+\d+)\]/);

  /** Depois do envio pela etapa Anúncios: busca os criativos novos, põe na lista e já marca no conjunto. */
  async function attachUploaded(adsetKey: string, driveFileIds: string[]) {
    if (!driveFileIds.length) return;
    const res = await fetch("/api/ad-creatives/by-drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ driveFileIds }) });
    const rows = ((await res.json().catch(() => null))?.creatives ?? []) as CreativeOption[];
    if (!rows.length) return;
    setCreatives((list) => [...rows.filter((row) => !list.some((c) => c.id === row.id)), ...list]);
    // Os arquivos enviados entram no grupo de textos aberto no momento.
    setPlan((p) => ({
      ...p,
      copyByAd: p.splitCopy ? { ...p.copyByAd, ...Object.fromEntries(rows.filter((row) => !p.adsets.find((a) => a.key === adsetKey)?.creativeIds.includes(row.id)).map((row) => [adCopyKey(adsetKey, row.id), tab])) } : p.copyByAd,
      adsets: p.adsets.map((a) => (a.key === adsetKey ? { ...a, creativeIds: Array.from(new Set([...a.creativeIds, ...rows.map((row) => row.id)])) } : a)),
    }));
    // Só pede os textos no criativo quando a campanha não tem textos próprios.
    const missing = rows.find((row) => !isReady(row));
    if (missing && !hasCopy(plan.copy)) setEditingCreative(missing);
  }

  const update = (key: string, fn: (a: PlanAdSet) => PlanAdSet) => setPlan((p) => ({ ...p, adsets: p.adsets.map((a) => (a.key === key ? fn(a) : a)) }));
  const total = planDailyTotal(plan);

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
        window.history.replaceState(null, "", `/trafego-raio-x/gestor?aba=nova&campanha=${id}`);
      } else {
        const res = await fetch(`/api/traffic/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não consegui salvar.");
      }
      if (keepUrlTags && plan.urlTags !== savedUrlTags) {
        await fetch("/api/traffic/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urlTags: plan.urlTags }) }).catch(() => null);
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

  /** Apaga o rascunho (os criativos enviados continuam na biblioteca e no Drive) e começa do zero. */
  async function discard() {
    if (!await confirmDialog("Descartar este rascunho? Os criativos enviados continuam na biblioteca.", { danger: true })) return;
    if (campaignId) {
      const res = await fetch(`/api/traffic/campaigns/${campaignId}`, { method: "DELETE" });
      if (!res.ok) {
        setMessage({ ok: false, text: (await res.json().catch(() => null))?.error ?? "Não consegui descartar." });
        return;
      }
    }
    router.push(`/trafego-raio-x/gestor?aba=nova&novo=${Date.now()}`);
    router.refresh();
  }

  async function submit() {
    const id = await save();
    if (!id) return;
    if (!await confirmDialog(`Subir "${plan.name}" para a Meta? A campanha vai pausada (conjuntos e anúncios ativos): ${plan.adsets.length} conjunto(s), R$ ${total.toFixed(2)}/dia quando ativar.`, { title: "Subir para a Meta", confirmLabel: "Subir campanha" })) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitLog([]);
    setStartedAt(Date.now());
    // Enquanto cada rodada roda no servidor (até 45 s), consulta o andamento para mostrar cada etapa criada.
    let polling = true;
    const poll = async () => {
      while (polling) {
        const r = await fetch(`/api/traffic/campaigns/${id}`).then((x) => x.json()).catch(() => null);
        if (polling && Array.isArray(r?.log)) setSubmitLog(r.log);
        await sleep(2500);
      }
    };
    void poll();
    let ok = false;
    let lastMessage = "";
    for (let round = 0; round < 40; round++) {
      const res = await fetch(`/api/traffic/campaigns/${id}/submit`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { done?: boolean; ok?: boolean; message?: string; error?: string } | null;
      lastMessage = data?.message ?? data?.error ?? "Erro desconhecido.";
      if (!res.ok || data?.done) {
        ok = res.ok && data?.ok === true;
        break;
      }
      await sleep(data?.message?.includes("processando") ? 10_000 : 500);
    }
    polling = false;
    if (ok) {
      router.push(`/trafego-raio-x/gestor?aba=campanhas&enviada=${id}`);
      router.refresh();
      return;
    }
    setSubmitting(false);
    setSubmitError(lastMessage);
    router.refresh();
  }

  const expectedSteps = 1 + plan.adsets.reduce((n, a) => n + (plan.conversion === "FORM" ? 1 : 0) + 1 + adsForAdSet(plan, a.key, a.creativeIds.map((cid) => creatives.find((c) => c.id === cid)).filter((c): c is CreativeOption => Boolean(c))).length, 0);
  const doneSteps = submitLog.filter((l) => /criad[oa]/i.test(l)).length;
  const percent = Math.min(100, Math.round((doneSteps / Math.max(1, expectedSteps)) * 100));
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;

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
            <p className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#344054]">
              Nome na Meta: <strong>{codeMatch ? plan.name : `[${nextCode ?? "LEAD??"}] ${plan.name}`}</strong>
              {!codeMatch && lastUsed && (
                <span className="block text-xs text-[#667085]">
                  Último número em uso na conta: <strong>{lastUsed.name}</strong> ({STATUS_LABEL[lastUsed.status] ?? lastUsed.status.toLowerCase()}). Campanhas excluídas ou arquivadas no Gerenciador liberam o número.
                </span>
              )}
              <span className="block text-xs text-[#667085]">O código do objetivo e o número entram sozinhos no envio, seguindo a sequência da conta (Reconhecimento REC, Tráfego TRAF, Engajamento ENG, Leads LEAD, Promoção do app APP, Vendas VEND).</span>
            </p>
            <div>
              <p className="mb-1 text-sm font-medium text-[#344054]">Objetivo: Leads. Onde o lead se cadastra?</p>
              <div className="flex flex-wrap gap-2">
                {([["FORM", "Formulário instantâneo da Meta"], ["SITE", "Formulário no site (conversão no pixel)"]] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setPlan((p) => ({ ...p, conversion: value }))} className={`rounded-lg px-3 py-2 text-sm font-medium ${plan.conversion === value ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-[#344054]">Orçamento</p>
              <div className="flex flex-wrap gap-2">
                {([["CAMPAIGN", "Orçamento da campanha (Advantage+)"], ["ADSET", "Orçamento por conjunto"]] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setPlan((p) => ({ ...p, budgetMode: value }))} className={`rounded-lg px-3 py-2 text-sm font-medium ${plan.budgetMode === value ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {plan.budgetMode === "CAMPAIGN" ? (
                <label className={`${LABEL} mt-2 max-w-xs`}>
                  Verba diária da campanha (R$)
                  <input type="number" value={plan.campaignDailyBudget} onChange={(e) => setPlan((p) => ({ ...p, campaignDailyBudget: Number(e.target.value) }))} className={INPUT} />
                  <span className="text-xs font-normal text-[#667085]">A Meta distribui a verba entre os conjuntos e anúncios com mais chance de resultado.</span>
                </label>
              ) : (
                <p className="mt-1 text-xs text-[#667085]">A verba fica em cada conjunto (etapa 2), para cada um ter o próprio controle.</p>
              )}
            </div>
            {budgetCap === null && <p className="rounded-lg bg-[#FFFAEB] px-3 py-2 text-sm text-[#B54708]">O teto de verba ainda não foi definido em Configurações. Dá para montar o rascunho, mas só sobe depois de definir.</p>}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPlan((x) => ({ ...x, adsets: [...x.adsets, newAdSet("", ["Americana"], defaultButtonUrl)] }))} className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-semibold text-white">
                + Conjunto
              </button>
              <button type="button" onClick={() => setPlan((x) => ({ ...x, adsets: [...x.adsets, ...defaultCities.map((city) => newAdSet("", [city], defaultButtonUrl))] }))} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054]">
                + Um conjunto por cidade ({defaultCities.length})
              </button>
              <span className="text-xs text-[#667085]">Nome automático: [nº] [AUTO/MANUAL] [FRIO/QUENTE] cidade | nicho</span>
            </div>
            {!plan.adsets.length && <p className="text-sm text-[#667085]">Nenhum conjunto ainda.</p>}
            {plan.adsets.map((a, index) => (
              <AdSetCard key={a.key} adset={a} index={index} budgetPerAdSet={plan.budgetMode === "ADSET"} defaultCities={defaultCities} onChange={(fn) => update(a.key, fn)} onRemove={() => setPlan((p) => ({ ...p, adsets: p.adsets.filter((x) => x.key !== a.key) }))} />
            ))}
            <p className={`text-sm font-medium ${budgetCap !== null && total > budgetCap ? "text-[#B42318]" : "text-[#344054]"}`}>
              {plan.budgetMode === "CAMPAIGN" ? "Orçamento da campanha" : "Total"}: R$ {total.toFixed(2)}/dia (≈ R$ {(total * 30).toFixed(0)}/mês){budgetCap !== null ? ` · teto R$ ${budgetCap.toFixed(2)}/dia` : ""}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {!plan.adsets.length && <p className="text-sm text-[#667085]">Adicione conjuntos na etapa 2.</p>}
            {plan.conversion === "FORM"
              ? plan.adsets.map((a, index) => <FormCard key={a.key} adset={a} title={adSetName(a, index)} onChange={(fn) => update(a.key, fn)} />)
              : plan.adsets.map((a, index) => (
                  <label key={a.key} className={LABEL}>
                    <span className="font-mono text-xs">{adSetName(a, index)}</span>
                    Página do site com o formulário (a conversão é o evento Lead do pixel)
                    <input value={a.destinationUrl} onChange={(e) => update(a.key, (x) => ({ ...x, destinationUrl: e.target.value }))} placeholder="https://hubzenite.com.br/..." className={INPUT} />
                  </label>
                ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[#EEF0F3] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#101828]">{plan.splitCopy ? "Grupos de textos" : "Textos de todos os anúncios"}</p>
                <label className="flex items-center gap-2 text-xs text-[#344054]">
                  <input
                    type="checkbox"
                    checked={plan.splitCopy}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setPlan((p) => ({ ...p, splitCopy: on, copyGroups: on && !p.copyGroups.length ? [emptyCopy()] : p.copyGroups }));
                      setCopyTab(0);
                    }}
                    className="accent-[#FF2B00]"
                  />
                  Separar os anúncios em grupos de textos
                </label>
              </div>
              <p className="mb-3 text-xs text-[#667085]">Cole tudo de uma vez: até 5 de cada. Os textos principais podem vir separados por rótulos (LEGENDA 1, Texto 2...), por uma linha &quot;---&quot;, por numeração (1., 2.) ou por duas linhas em branco; os rótulos saem sozinhos. Títulos e descrições: um por linha.{plan.splitCopy ? " Cada anúncio escolhe o grupo logo abaixo, no conjunto." : " Valem para todos os anúncios."}</p>
              {plan.splitCopy && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {Array.from({ length: groupCount }, (_, i) => (
                    <button key={i} type="button" onClick={() => setCopyTab(i)} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === i ? "bg-[#FF2B00] text-white" : "bg-white text-[#475467] ring-1 ring-[#E4E7EC]"}`}>
                      Grupo {i + 1}
                    </button>
                  ))}
                  {groupCount < 10 && (
                    <button type="button" onClick={() => { setPlan((p) => ({ ...p, copyGroups: [...p.copyGroups, emptyCopy()] })); setCopyTab(groupCount); }} className="rounded-full px-3 py-1 text-xs font-semibold text-[#FF2B00] ring-1 ring-[#FF2B00]">
                      + Grupo
                    </button>
                  )}
                  {tab > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const removed = tab;
                        setPlan((p) => {
                          const copyByAd: Record<string, number> = {};
                          for (const [k, n] of Object.entries(p.copyByAd)) copyByAd[k] = n === removed ? 0 : n > removed ? n - 1 : n;
                          const copyGroups = p.copyGroups.filter((_, i) => i !== removed - 1);
                          return { ...p, copyGroups, copyByAd, splitCopy: copyGroups.length > 0 };
                        });
                        setCopyTab(0);
                      }}
                      className="text-xs font-semibold text-[#B42318]"
                    >
                      Remover grupo {tab + 1}
                    </button>
                  )}
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-3">
                {(
                  [
                    { label: "Textos principais", raw: pasteTexts, setRaw: setPasteTexts, items: activeCopy.primaryTexts, field: "primaryTexts", split: splitPrimaryTexts, rows: 8 },
                    { label: "Títulos", raw: pasteHeadlines, setRaw: setPasteHeadlines, items: activeCopy.headlines, field: "headlines", split: splitLines, rows: 5 },
                    { label: "Descrições (opcional)", raw: pasteDescriptions, setRaw: setPasteDescriptions, items: activeCopy.descriptions, field: "descriptions", split: splitLines, rows: 5 },
                  ] as const
                ).map((box) => (
                  <div key={box.field} className="flex flex-col gap-2">
                    <label className={LABEL}>
                      {box.label}
                      <textarea value={box.raw} rows={box.rows} onChange={(e) => box.setRaw(e.target.value)} placeholder="Cole aqui" className={INPUT} />
                    </label>
                    <button type="button" disabled={!box.raw.trim()} onClick={() => { setCopy({ [box.field]: box.split(box.raw) }); box.setRaw(""); }} className="self-start rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                      Separar e usar
                    </button>
                    {box.items.length > 0 && (
                      <ol className="space-y-1.5">
                        {box.items.map((item, i) => (
                          <li key={i} className="flex gap-2 rounded-lg bg-[#F9FAFB] p-2 text-xs text-[#344054]">
                            <span className="font-semibold text-[#FF2B00]">{i + 1}</span>
                            <textarea value={item} rows={box.field === "primaryTexts" ? 4 : 1} onChange={(e) => setCopy({ [box.field]: box.items.map((x, j) => (j === i ? e.target.value : x)) })} className="min-w-0 flex-1 resize-y rounded border border-[#EEF0F3] bg-white p-1" />
                            <button type="button" onClick={() => setCopy({ [box.field]: box.items.filter((_, j) => j !== i) })} className="self-start text-[#B42318]">×</button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#EEF0F3] p-4">
                <p className="text-sm font-semibold text-[#101828]">Advantage+ de criativo</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-[#344054]">
                  <input type="checkbox" checked={plan.advantageCreative} onChange={(e) => setPlan((p) => ({ ...p, advantageCreative: e.target.checked }))} className="accent-[#FF2B00]" />
                  Todas as otimizações ligadas
                </label>
                <p className="mt-1 text-xs text-[#667085]">Sobreposições, retoques visuais, música, melhorias no texto, animação, detalhes e etiquetas, comentários relevantes, CTA e brilho/contraste.</p>
              </div>
              <div className="rounded-xl border border-[#EEF0F3] p-4">
                <p className="text-sm font-semibold text-[#101828]">Rastreamento</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#344054]">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={plan.trackSiteEvents} onChange={(e) => setPlan((p) => ({ ...p, trackSiteEvents: e.target.checked }))} className="accent-[#FF2B00]" />Eventos do site</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={plan.trackOfflineEvents} onChange={(e) => setPlan((p) => ({ ...p, trackOfflineEvents: e.target.checked }))} className="accent-[#FF2B00]" />Eventos offline</label>
                </div>
                <label className={`${LABEL} mt-3`}>
                  Parâmetros de URL (UTMs)
                  <textarea value={plan.urlTags} rows={3} onChange={(e) => setPlan((p) => ({ ...p, urlTags: e.target.value }))} className={`${INPUT} font-mono text-xs`} />
                </label>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-[#344054]">
                    <input type="checkbox" checked={keepUrlTags} onChange={(e) => setKeepUrlTags(e.target.checked)} className="accent-[#FF2B00]" />
                    Manter este padrão para as próximas campanhas
                  </label>
                  <button type="button" onClick={() => setPlan((p) => ({ ...p, urlTags: DEFAULT_URL_TAGS }))} className="text-xs font-semibold text-[#FF2B00]">Usar o padrão Zenite</button>
                </div>
              </div>
            </div>

            {!plan.adsets.length && <p className="text-sm text-[#667085]">Adicione conjuntos na etapa 2.</p>}
            {plan.adsets.map((a) => {
              // Com grupos ligados, cada grupo de textos tem os próprios criativos (mostra só os do grupo aberto).
              const allSelected = a.creativeIds.map((id) => creatives.find((c) => c.id === id)).filter((c): c is CreativeOption => Boolean(c));
              const selected = allSelected.filter((c) => creativeGroup(plan, a.key, c.id) === tab);
              const others = creatives.filter((c) => !a.creativeIds.includes(c.id));
              const toggle = (id: string) =>
                setPlan((p) => {
                  const removing = a.creativeIds.includes(id);
                  return {
                    ...p,
                    copyByAd: !removing && p.splitCopy ? { ...p.copyByAd, [adCopyKey(a.key, id)]: tab } : p.copyByAd,
                    adsets: p.adsets.map((x) => (x.key === a.key ? { ...x, creativeIds: removing ? x.creativeIds.filter((y) => y !== id) : [...x.creativeIds, id] } : x)),
                  };
                });
              const adsList = adsForAdSet(plan, a.key, allSelected);
              return (
                <div key={a.key} className="rounded-xl border border-[#EEF0F3] p-4">
                  <p className="mb-3 font-mono text-sm font-semibold text-[#101828]">{adSetName(a, plan.adsets.indexOf(a))} · {adsList.length} anúncio(s)</p>
                  {plan.splitCopy && <p className="mb-2 text-xs font-semibold text-[#FF2B00]">Criativos do Grupo {tab + 1} (troque o grupo nas abas acima)</p>}
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
                            <span className="block truncate font-medium text-[#101828]">{c.name}{c.kind === "IMAGE" ? ` · ${creativeRole(c) === "S" ? "Stories" : "Feed"}` : ""}</span>
                            {hasCopy(copyForAd(plan, a.key, c.id)) ? (
                              <span className="text-xs font-semibold text-[#027A48]">Usa os textos da campanha</span>
                            ) : (
                              <button type="button" onClick={() => setEditingCreative(c)} className={`text-xs font-semibold ${isReady(c) ? "text-[#027A48]" : "text-[#B54708]"}`}>
                                {isReady(c) ? "Textos ok · editar" : "Preencher textos"}
                              </button>
                            )}
                          </span>
                          <button type="button" onClick={() => toggle(c.id)} aria-label="Tirar do conjunto" className="text-[#B42318]">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {adsList.length > 0 && (
                    <ul className="mt-3 space-y-1 rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#344054]">
                      <li className="font-semibold">Como os anúncios vão subir:</li>
                      {adsList.map((g, i) => (
                        <li key={g.key} className="flex flex-wrap items-center gap-2">
                          <span>
                            <strong>AD{String(i + 1).padStart(2, "0")}</strong>:{" "}
                            {g.feed && g.stories ? `Feed "${g.feed.name}" + Stories "${g.stories.name}" (cada um no seu posicionamento)` : g.feed?.kind === "VIDEO" ? `vídeo "${g.feed.name}"` : `"${(g.feed ?? g.stories)!.name}" em todos os posicionamentos`}
                          </span>
                          {plan.splitCopy && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#FF2B00]">Grupo {g.copyGroup + 1}</span>}
                        </li>
                      ))}
                      <li className="text-[#667085]">Par Feed/Stories reconhecido pelo fim do nome (-F/-S, -FD/-ST) ou pela proporção. Ao subir, os arquivos são renomeados para o padrão 01-01-AD01-F.</li>
                    </ul>
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
                {plan.adsets.map((a, index) => (
                  <li key={a.key} className="border-l-2 border-[#FF2B00] pl-3">
                    <p className="font-medium text-[#101828]">{adSetName(a, index)}{plan.budgetMode === "ADSET" ? ` · R$ ${Number(a.dailyBudget).toFixed(2)}/dia` : ""}</p>
                    <p className="text-xs text-[#667085]">
                      {a.geoMode === "RADIUS" ? `raio ${a.radiusKm} km` : "apenas a cidade"} · {a.advantage ? "Advantage+ com sugestão de " : ""}{a.ageMin}–{a.ageMax} anos{a.gender ? (a.gender === 1 ? ", homens" : ", mulheres") : ""} · {a.interests.length ? a.interests.map((i) => i.name).join(", ") : "sem interesses"}{a.temperature === "QUENTE" ? ` · remarketing: ${a.customAudiences.map((c) => c.name).join(", ") || "nenhum público"}` : ""}
                    </p>
                    <p className="text-xs text-[#667085]">{plan.conversion === "FORM" ? `Formulário: ${a.form.introTitle || "(sem título)"} · ${a.form.questions.length + (a.form.askCity ? 1 : 0) + 3} perguntas` : `Site: ${a.destinationUrl || "(sem link)"}`}</p>
                    <p className="text-xs text-[#667085]">{a.creativeIds.length} anúncio(s): {a.creativeIds.map((id) => creatives.find((c) => c.id === id)?.name ?? "?").join(", ")}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-medium text-[#101828]">{plan.budgetMode === "CAMPAIGN" ? "Orçamento da campanha (Advantage+)" : "Total"} quando ativar: R$ {total.toFixed(2)}/dia (≈ R$ {(total * 30).toFixed(0)}/mês)</p>
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
              <p className="rounded-lg bg-[#ECFDF3] px-3 py-2 text-sm text-[#027A48]">Tudo certo para subir. A campanha vai pausada; conjuntos e anúncios vão ativos e começam a rodar quando você ativar a campanha.</p>
            )}
            {submitting && (
              <div className="rounded-xl border border-[#FF2B00]/40 bg-[#FFF4ED] p-4" aria-live="polite">
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF2B00] border-t-transparent" />
                  <p className="text-sm font-semibold text-[#101828]">Subindo para a Meta… {doneSteps} de {expectedSteps} etapas</p>
                  <span className="ml-auto text-xs text-[#667085]">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-[#FF2B00] transition-all duration-700" style={{ width: `${Math.max(4, percent)}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#667085]">Não feche esta página. Envio de imagens e vídeos pode levar alguns minutos.</p>
                {submitLog.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-[#344054]">
                    {submitLog.map((l, i) => (
                      <li key={i}>✓ {l}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!submitting && submitError && (
              <div className="rounded-xl border border-[#FECDCA] bg-[#FEF3F2] p-4 text-sm text-[#B42318]">
                <p className="font-semibold">A campanha não terminou de subir.</p>
                <p className="mt-1">{submitError}</p>
                {submitLog.length > 0 && <p className="mt-2 text-xs">Já criado na Meta: {submitLog.join(" · ")}</p>}
              </div>
            )}
            <div>
              <button type="button" disabled={submitting || saving || !issues || issues.length > 0} onClick={submit} className="rounded-lg bg-[#FF2B00] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {submitting ? "Subindo…" : "Aprovar e subir (campanha pausada)"}
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
        <button type="button" disabled={saving || submitting} onClick={discard} className="ml-auto rounded-lg border border-[#FECDCA] bg-white px-4 py-2 text-sm font-medium text-[#B42318] hover:bg-[#FEF3F2]">
          Descartar rascunho
        </button>
      </div>
    </section>
  );
}

function AdSetCard({ adset: a, index, budgetPerAdSet, defaultCities, onChange, onRemove }: { adset: PlanAdSet; index: number; budgetPerAdSet: boolean; defaultCities: string[]; onChange: (fn: (a: PlanAdSet) => PlanAdSet) => void; onRemove: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; audience?: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [extraCity, setExtraCity] = useState("");
  const [audiences, setAudiences] = useState<{ id: string; name: string; size?: number }[] | null>(null);
  const preset = NICHE_PRESETS.find((p) => p.niche === a.niche);
  const allCities = Array.from(new Set([...defaultCities, ...a.cities]));
  const toggleBtn = (on: boolean) => `rounded-lg px-3 py-1.5 text-xs font-semibold ${on ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#475467]"}`;

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

  async function loadAudiences() {
    if (audiences) return;
    const res = await fetch("/api/traffic/audiences");
    const data = await res.json().catch(() => null);
    if (!res.ok) setError(data?.error ?? "Não consegui listar os públicos.");
    setAudiences(data?.audiences ?? []);
  }

  return (
    <div className="rounded-xl border border-[#EEF0F3] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="rounded-lg bg-[#F9FAFB] px-3 py-1.5 font-mono text-sm font-semibold text-[#101828]">{adSetName(a, index)}</p>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-[#B42318]">Remover</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
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
          <div>
            <p className="mb-1 text-sm font-medium text-[#344054]">Localização</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => onChange((x) => ({ ...x, geoMode: "CITY" }))} className={toggleBtn(a.geoMode === "CITY")}>Apenas a cidade</button>
              <button type="button" onClick={() => onChange((x) => ({ ...x, geoMode: "RADIUS" }))} className={toggleBtn(a.geoMode === "RADIUS")}>Cidade + raio</button>
              {a.geoMode === "RADIUS" && (
                <label className="flex items-center gap-1 text-xs text-[#475467]">
                  <input type="number" min={17} max={80} value={a.radiusKm} onChange={(e) => onChange((x) => ({ ...x, radiusKm: Number(e.target.value) }))} className="w-20 rounded-lg border border-[#D0D5DD] px-2 py-1.5 text-sm" /> km (17 a 80)
                </label>
              )}
            </div>
          </div>
          <label className={LABEL}>
            Nicho (opcional)
            <input value={a.niche} onChange={(e) => { const niche = e.target.value; onChange((x) => ({ ...x, niche, form: { ...x.form, questions: x.form.questions.map((q) => (niche.trim() && q.label.startsWith("Qual é o segmento") ? { label: "Qual é o @ do Instagram da sua empresa?", options: [] } : !niche.trim() && q.label.startsWith("Qual é o @ do Instagram") ? { label: "Qual é o segmento da sua empresa? (Ex: Clínica Estética, Lanchonete)", options: [] } : q)) } })); }} list="traffic-niches" placeholder="Deixe vazio para empresários em geral" className={INPUT} />
            <datalist id="traffic-niches">
              {NICHE_PRESETS.map((p) => (
                <option key={p.niche} value={p.niche} />
              ))}
            </datalist>
          </label>
          {budgetPerAdSet && (
            <label className={LABEL}>
              Verba diária (R$)
              <input type="number" value={a.dailyBudget} onChange={(e) => onChange((x) => ({ ...x, dailyBudget: Number(e.target.value) }))} className={INPUT} />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-sm font-medium text-[#344054]">Público</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onChange((x) => ({ ...x, temperature: "FRIO" }))} className={toggleBtn(a.temperature === "FRIO")}>[FRIO] Público aberto</button>
              <button type="button" onClick={() => { onChange((x) => ({ ...x, temperature: "QUENTE" })); loadAudiences(); }} className={toggleBtn(a.temperature === "QUENTE")}>[QUENTE] Remarketing</button>
            </div>
            {a.temperature === "QUENTE" && (
              <div className="mt-2 rounded-lg bg-[#F9FAFB] p-2">
                <p className="mb-1 text-xs text-[#667085]">Públicos personalizados da conta:</p>
                {audiences === null ? (
                  <button type="button" onClick={loadAudiences} className="text-xs font-semibold text-[#FF2B00]">Carregar públicos</button>
                ) : audiences.length === 0 ? (
                  <p className="text-xs text-[#B54708]">Nenhum público personalizado na conta. Crie no Gerenciador (visitantes do site, engajamento no Instagram etc.).</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {audiences.map((aud) => {
                      const on = a.customAudiences.some((c) => c.id === aud.id);
                      return (
                        <button key={aud.id} type="button" onClick={() => onChange((x) => ({ ...x, customAudiences: on ? x.customAudiences.filter((c) => c.id !== aud.id) : [...x.customAudiences, { id: aud.id, name: aud.name }] }))} className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
                          {aud.name}{aud.size ? ` (${aud.size.toLocaleString("pt-BR")})` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-[#344054]">
            <input type="checkbox" checked={a.advantage} onChange={(e) => onChange((x) => ({ ...x, advantage: e.target.checked }))} className="accent-[#FF2B00]" />
            Advantage+ de público ligado <span className="text-xs text-[#667085]">(idade, gênero e interesses viram sugestões)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className={LABEL}>{a.advantage ? "Idade sugerida de" : "Idade de"}<input type="number" value={a.ageMin} onChange={(e) => onChange((x) => ({ ...x, ageMin: Number(e.target.value) }))} className={INPUT} /></label>
            <label className={LABEL}>até<input type="number" value={a.ageMax} onChange={(e) => onChange((x) => ({ ...x, ageMax: Number(e.target.value) }))} className={INPUT} /></label>
            <label className={LABEL}>
              {a.advantage ? "Gênero sugerido" : "Gênero"}
              <select value={a.gender} onChange={(e) => onChange((x) => ({ ...x, gender: Number(e.target.value) as 0 | 1 | 2 }))} className={INPUT}>
                <option value={0}>Todos</option>
                <option value={1}>Homens</option>
                <option value={2}>Mulheres</option>
              </select>
            </label>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-[#344054]">Interesses {a.advantage ? "sugeridos" : ""} (opcional)</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {a.interests.map((i) => (
                <span key={i.id} className="flex items-center gap-1 rounded-full bg-[#FFF4ED] px-2.5 py-1 text-xs text-[#101828]">
                  {i.name}
                  <button type="button" onClick={() => onChange((x) => ({ ...x, interests: x.interests.filter((y) => y.id !== i.id) }))} className="text-[#B42318]">×</button>
                </span>
              ))}
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
                {results.map((res) => (
                  <button key={res.id} type="button" disabled={a.interests.some((i) => i.id === res.id)} onClick={() => onChange((x) => ({ ...x, interests: [...x.interests, { id: res.id, name: res.name }] }))} className="rounded-full border border-[#D0D5DD] px-2.5 py-1 text-xs text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-40">
                    + {res.name}{res.audience ? ` (${(res.audience / 1_000_000).toFixed(1)} mi)` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormCard({ adset: a, title, onChange }: { adset: PlanAdSet; title: string; onChange: (fn: (a: PlanAdSet) => PlanAdSet) => void }) {
  const setForm = (patch: Partial<PlanAdSet["form"]>) => onChange((x) => ({ ...x, form: { ...x.form, ...patch } }));
  return (
    <div className="rounded-xl border border-[#EEF0F3] p-4">
      <p className="mb-3 text-sm font-semibold text-[#101828]">Formulário instantâneo · <span className="font-mono">{title}</span></p>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <label className={LABEL}>Título da abertura<input value={a.form.introTitle} maxLength={60} onChange={(e) => setForm({ introTitle: e.target.value })} className={INPUT} /></label>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-[#344054]">Saudação em lista (até 5 itens, 80 letras cada)</p>
            {[0, 1, 2, 3, 4].map((i) => (
              <input key={i} value={a.form.introBullets[i] ?? ""} maxLength={80} onChange={(e) => { const next = [...a.form.introBullets]; next[i] = e.target.value; setForm({ introBullets: next }); }} placeholder={`Item ${i + 1}`} className={INPUT} />
            ))}
          </div>
          {a.niche.trim() && a.form.questions.some((q) => q.label.startsWith("Qual é o segmento")) && (
            <button type="button" onClick={() => setForm({ questions: a.form.questions.map((q) => (q.label.startsWith("Qual é o segmento") ? { label: "Qual é o @ do Instagram da sua empresa?", options: [] } : q)) })} className="self-start text-xs font-semibold text-[#FF2B00]">
              Conjunto com nicho: trocar a pergunta do segmento pela do Instagram
            </button>
          )}
          <label className={LABEL}>Texto acima dos dados de contato<input value={a.form.contactText} maxLength={200} onChange={(e) => setForm({ contactText: e.target.value })} className={INPUT} /></label>
          <p className="text-xs text-[#667085]">Dados de contato sempre pedidos no fim (a Meta preenche com o Facebook da pessoa): nome completo, e-mail e telefone.</p>
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
            <p className="mt-1 whitespace-pre-line text-[#475467]">{a.form.introBullets.filter(Boolean).length ? a.form.introBullets.filter(Boolean).map((b) => `• ${b}`).join("\n") : a.form.introText || "Saudação"}</p>
            <div className="mt-3 space-y-1.5">
              {[...(a.form.askCity ? ["Em qual cidade fica a sua empresa?"] : []), ...a.form.questions.map((q) => q.label || "Pergunta"), "Nome completo", "E-mail", "Telefone"].map((q, i) => (
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
