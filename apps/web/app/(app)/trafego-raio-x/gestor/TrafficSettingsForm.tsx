"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Values {
  dailyBudgetCap: string;
  cplGood: string;
  cplMax: string;
  maxBudgetChangePct: string;
  killSwitch: boolean;
  pageConnectionId: string;
  privacyPolicyUrl: string;
  websiteUrl: string;
  rules: { noLeadSpendMultiplier: string; minLeadsToJudgeBad: string; minLeadsToScale: string; fatigueFrequency: string; fatigueCtrDropPct: string };
}

const RULE_FIELDS: { key: keyof Values["rules"]; label: string; hint: string }[] = [
  { key: "noLeadSpendMultiplier", label: "Pausar sem lead após gastar (× CPL máximo)", hint: "Ex.: 2 = anúncio que gastou 2× o custo por lead máximo sem nenhum lead." },
  { key: "minLeadsToJudgeBad", label: "Leads mínimos para julgar CPL alto", hint: "Abaixo disso ainda é cedo para pausar ou reduzir." },
  { key: "minLeadsToScale", label: "Leads mínimos para aumentar verba", hint: "Com CPL bom e pelo menos esse número de leads em 7 dias." },
  { key: "fatigueFrequency", label: "Frequência de público cansado", hint: "Junto com a queda da taxa de cliques abaixo." },
  { key: "fatigueCtrDropPct", label: "Queda da taxa de cliques (%)", hint: "Frente à semana anterior." },
];

const INPUT = "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

/** Travas do gestor: teto de verba, custo por lead, página que assina os anúncios e botão de emergência. */
export function TrafficSettingsForm({ initial, saved, pages }: { initial: Values; saved: boolean; pages: { id: string; label: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(saved ? null : { ok: false, text: "Preencha e salve antes de subir a primeira campanha." });
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [key]: e.target.value }));

  async function save(next = v) {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/traffic/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setBusy(false);
    if (!response.ok) {
      setMessage({ ok: false, text: (await response.json().catch(() => null))?.error ?? "Não consegui salvar." });
      return;
    }
    setMessage({ ok: true, text: "Configurações salvas." });
    router.refresh();
  }

  return (
    <section className="flex max-w-3xl flex-col gap-4 rounded-xl border border-[#E4E7EC] bg-white p-5">
      <div className={`flex items-center justify-between gap-3 rounded-lg p-3 ${v.killSwitch ? "bg-[#FEF3F2]" : "bg-[#F9FAFB]"}`}>
        <div>
          <p className="text-sm font-semibold text-[#101828]">Botão de emergência</p>
          <p className="text-xs text-[#667085]">Ligado, nada sobe nem muda na Meta pelo sistema.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const next = { ...v, killSwitch: !v.killSwitch };
            setV(next);
            save(next);
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${v.killSwitch ? "bg-[#B42318] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}
        >
          {v.killSwitch ? "Ligado: desligar" : "Desligado: ligar"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
          Teto de verba diária (R$)
          <input value={v.dailyBudgetCap} onChange={set("dailyBudgetCap")} inputMode="decimal" placeholder="Ex.: 150" className={INPUT} />
          <span className="text-xs font-normal text-[#667085]">Soma das verbas dos conjuntos de uma campanha.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
          Custo por lead bom (R$)
          <input value={v.cplGood} onChange={set("cplGood")} inputMode="decimal" placeholder="Ex.: 20" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
          Custo por lead máximo (R$)
          <input value={v.cplMax} onChange={set("cplMax")} inputMode="decimal" placeholder="Ex.: 45" className={INPUT} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
        Página do Facebook que assina os anúncios e guarda os formulários
        <select value={v.pageConnectionId} onChange={set("pageConnectionId")} className={INPUT}>
          <option value="">Escolha a página</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <span className="text-xs font-normal text-[#667085]">Os leads dos formulários entram sozinhos no CRM quando a página tem os formulários ligados (Clientes → perfil → Leads da Meta).</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
          Política de privacidade (link)
          <input value={v.privacyPolicyUrl} onChange={set("privacyPolicyUrl")} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
          Site (link padrão dos anúncios)
          <input value={v.websiteUrl} onChange={set("websiteUrl")} className={INPUT} />
        </label>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-[#344054]">
        Ajuste máximo de verba por dia (%)
        <input value={v.maxBudgetChangePct} onChange={set("maxBudgetChangePct")} inputMode="numeric" className={INPUT} />
        <span className="text-xs font-normal text-[#667085]">Limite de aumento por vez nos botões de verba e nas recomendações.</span>
      </label>

      <div className="rounded-xl border border-[#EEF0F3] p-4">
        <p className="text-sm font-semibold text-[#101828]">Recomendações diárias</p>
        <p className="mb-3 text-xs text-[#667085]">Todo dia às 6h (e ao atualizar da Meta) o Raio X olha os últimos 7 dias e sugere ações. Nada é aplicado sem você.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {RULE_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
              {f.label}
              <input value={v.rules[f.key]} onChange={(e) => setV((x) => ({ ...x, rules: { ...x.rules, [f.key]: e.target.value } }))} inputMode="decimal" className={INPUT} />
              <span className="text-xs font-normal text-[#667085]">{f.hint}</span>
            </label>
          ))}
        </div>
      </div>

      {message && <p className={`text-sm ${message.ok ? "text-[#027A48]" : "text-[#B54708]"}`}>{message.text}</p>}
      <div>
        <button type="button" disabled={busy} onClick={() => save()} className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </section>
  );
}
