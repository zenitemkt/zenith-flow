"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";

interface Rule {
  id: string;
  triggerType: string;
  keyword: string | null;
  responseText: string;
  buttonText: string | null;
  buttonUrl: string | null;
  mediaId: string | null;
  mediaCaption: string | null;
  mediaPermalink: string | null;
  publicReplyTexts: string[];
  active: boolean;
}

interface MediaItem {
  id: string;
  caption: string | null;
  permalink: string;
  mediaType: string;
  thumbnailUrl: string | null;
}

interface Metrics {
  total: number;
  sent: number;
  readPct: number;
  clickedPct: number;
  noMatch: number;
  failed: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  direct_message: "Mensagem direta (DM)",
  story_reply: "Resposta a story",
  comment: "Comentário",
};

function emptyDraft(triggerType: string): Omit<Rule, "id" | "active"> {
  return { triggerType, keyword: "", responseText: "", buttonText: "", buttonUrl: "", mediaId: null, mediaCaption: null, mediaPermalink: null, publicReplyTexts: [] };
}

export function InstagramRulesClient({
  clients,
  selectedClientId,
  initialRules,
  instagramConnected,
  instagramUsername,
}: {
  clients: Array<{ id: string; name: string }>;
  selectedClientId: string;
  initialRules: Rule[];
  instagramConnected: boolean;
  instagramUsername: string | null;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creatingTrigger, setCreatingTrigger] = useState<string | null>(null);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  useEffect(() => {
    fetch(`/api/instagram-rules/metrics?clientId=${selectedClientId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, [selectedClientId]);

  async function activateAutomation() {
    setSubscribing(true);
    setSubscribeMsg(null);
    const response = await fetch("/api/instagram-rules/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId }),
    });
    setSubscribing(false);
    const body = await response.json().catch(() => null);
    setSubscribeMsg(response.ok ? "Automação ativada." : (body?.error ?? "Falha ao ativar."));
  }

  async function toggleActive(rule: Rule) {
    const response = await fetch(`/api/instagram-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    if (response.ok) setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
  }

  async function deleteRule(rule: Rule) {
    if (!confirm(`Apagar a regra "${rule.keyword || "pega-tudo"}" (${TRIGGER_LABELS[rule.triggerType]})?`)) return;
    const response = await fetch(`/api/instagram-rules/${rule.id}`, { method: "DELETE" });
    if (response.ok) setRules((prev) => prev.filter((r) => r.id !== rule.id));
  }

  function grouped() {
    return ["direct_message", "story_reply", "comment"].map((type) => ({ type, rules: rules.filter((r) => r.triggerType === type) }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#E4E7EC] bg-white p-3">
        <label className="flex min-w-48 flex-col gap-1 text-xs font-medium text-[#475467]">
          Cliente
          <select
            value={selectedClientId}
            onChange={(event) => router.push(`/automacoes/instagram?clientId=${event.target.value}`)}
            className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={activateAutomation}
            disabled={subscribing || !instagramConnected}
            className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subscribing ? "Ativando..." : "Ativar automação"}
          </button>
          {instagramUsername && <span className="text-xs text-[#667085]">@{instagramUsername}</span>}
          {subscribeMsg && <span className="text-xs font-medium text-[#344054]">{subscribeMsg}</span>}
        </div>
      </div>

      {metrics && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Métricas (últimos 30 dias)</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="enviadas" value={metrics.sent} />
            <Stat label="lidas" value={`${metrics.readPct}%`} />
            <Stat label="clicaram no botão" value={`${metrics.clickedPct}%`} />
            <Stat label="sem regra correspondente" value={metrics.noMatch} />
            <Stat label="falharam" value={metrics.failed} />
          </div>
        </section>
      )}

      {grouped().map(({ type, rules: typeRules }) => (
        <section key={type} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">{TRIGGER_LABELS[type]}</h2>
            <button
              type="button"
              onClick={() => setCreatingTrigger(type)}
              className="h-8 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              + Nova regra
            </button>
          </div>
          {typeRules.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#98A2B3]">Nenhuma regra ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {typeRules.map((rule) => (
                <div key={rule.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[#EEF0F3] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#344054]">
                        {rule.keyword ? `"${rule.keyword}"` : "pega-tudo"}
                      </span>
                      {rule.mediaId && <span className="rounded-full bg-[#FFF4ED] px-2 py-0.5 text-xs font-medium text-[#B93815]">post específico</span>}
                      {!rule.active && <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#98A2B3]">pausada</span>}
                    </div>
                    <p className="truncate text-sm text-[#344054]" title={rule.responseText}>{rule.responseText}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => toggleActive(rule)} className="h-8 rounded-lg border border-[#D0D5DD] px-2.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                      {rule.active ? "Pausar" : "Ativar"}
                    </button>
                    <button type="button" onClick={() => setEditing(rule)} className="h-8 rounded-lg border border-[#D0D5DD] px-2.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                      Editar
                    </button>
                    <button type="button" onClick={() => deleteRule(rule)} className="h-8 rounded-lg border border-[#FDA29B] px-2.5 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2]">
                      Apagar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <RuleFormModal
        open={creatingTrigger !== null || editing !== null}
        clientId={selectedClientId}
        initial={editing ?? (creatingTrigger ? { id: "", active: true, ...emptyDraft(creatingTrigger) } : null)}
        isEditing={editing !== null}
        onClose={() => {
          setEditing(null);
          setCreatingTrigger(null);
        }}
        onSaved={(rule, isNew) => {
          setRules((prev) => (isNew ? [rule, ...prev] : prev.map((r) => (r.id === rule.id ? rule : r))));
          setEditing(null);
          setCreatingTrigger(null);
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#EEF0F3] p-3">
      <p className="text-xl font-semibold text-[#101828]">{value}</p>
      <p className="text-xs text-[#667085]">{label}</p>
    </div>
  );
}

function RuleFormModal({
  open,
  clientId,
  initial,
  isEditing,
  onClose,
  onSaved,
}: {
  open: boolean;
  clientId: string;
  initial: Rule | null;
  isEditing: boolean;
  onClose: () => void;
  onSaved: (rule: Rule, isNew: boolean) => void;
}) {
  const [triggerType, setTriggerType] = useState(initial?.triggerType ?? "direct_message");
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [responseText, setResponseText] = useState(initial?.responseText ?? "");
  const [buttonText, setButtonText] = useState(initial?.buttonText ?? "");
  const [buttonUrl, setButtonUrl] = useState(initial?.buttonUrl ?? "");
  const [mediaScope, setMediaScope] = useState<"any" | "specific">(initial?.mediaId ? "specific" : "any");
  const [mediaId, setMediaId] = useState(initial?.mediaId ?? null as string | null);
  const [mediaCaption, setMediaCaption] = useState(initial?.mediaCaption ?? null as string | null);
  const [publicReplyTexts, setPublicReplyTexts] = useState((initial?.publicReplyTexts ?? []).join("\n"));
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTriggerType(initial?.triggerType ?? "direct_message");
    setKeyword(initial?.keyword ?? "");
    setResponseText(initial?.responseText ?? "");
    setButtonText(initial?.buttonText ?? "");
    setButtonUrl(initial?.buttonUrl ?? "");
    setMediaScope(initial?.mediaId ? "specific" : "any");
    setMediaId(initial?.mediaId ?? null);
    setMediaCaption(initial?.mediaCaption ?? null);
    setPublicReplyTexts((initial?.publicReplyTexts ?? []).join("\n"));
    setError(null);
  }, [initial]);

  useEffect(() => {
    if (!open || triggerType !== "comment") return;
    fetch(`/api/instagram-rules/media?clientId=${clientId}`)
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((body) => setMedia(body.media ?? []))
      .catch(() => setMedia([]));
  }, [open, triggerType, clientId]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      clientId,
      triggerType,
      keyword: keyword || null,
      responseText,
      buttonText: buttonText || null,
      buttonUrl: buttonUrl || null,
      mediaId: triggerType === "comment" && mediaScope === "specific" ? mediaId : null,
      mediaCaption: triggerType === "comment" && mediaScope === "specific" ? mediaCaption : null,
      publicReplyTexts: triggerType === "comment" ? publicReplyTexts.split("\n").map((l) => l.trim()).filter(Boolean) : [],
    };
    const isNew = !isEditing;
    const response = await fetch(isNew ? "/api/instagram-rules" : `/api/instagram-rules/${initial!.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    onSaved(body.rule, isNew);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar regra" : "Nova regra"} size="lg">
      <div className="flex flex-col gap-4">
        {!isEditing && (
          <div className="flex gap-2">
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTriggerType(value)}
                className={`h-9 flex-1 rounded-lg border px-3 text-xs font-semibold ${
                  triggerType === value ? "border-[#FF2B00] bg-[#FFF4F2] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Palavra-chave (vazio = responde qualquer coisa)
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
        </label>

        {triggerType === "comment" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-[#475467]">Onde vale</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMediaScope("any")} className={`h-9 flex-1 rounded-lg border px-3 text-xs font-semibold ${mediaScope === "any" ? "border-[#FF2B00] bg-[#FFF4F2] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054]"}`}>
                Qualquer post
              </button>
              <button type="button" onClick={() => setMediaScope("specific")} className={`h-9 flex-1 rounded-lg border px-3 text-xs font-semibold ${mediaScope === "specific" ? "border-[#FF2B00] bg-[#FFF4F2] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054]"}`}>
                Post específico
              </button>
            </div>
            {mediaScope === "specific" && (
              <select
                value={mediaId ?? ""}
                onChange={(e) => {
                  const item = media.find((m) => m.id === e.target.value);
                  setMediaId(e.target.value || null);
                  setMediaCaption(item?.caption ?? null);
                }}
                className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm"
              >
                <option value="">Selecione um post...</option>
                {media.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.caption ? item.caption.slice(0, 60) : item.id} ({item.mediaType})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Mensagem privada (DM enviada)
          <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3} className="rounded-lg border border-[#D0D5DD] p-2.5 text-sm" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
            Texto do botão (opcional)
            <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
            Link do botão
            <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
          </label>
        </div>

        {triggerType === "comment" && (
          <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
            Respostas públicas (uma por linha — sorteia uma a cada comentário)
            <textarea value={publicReplyTexts} onChange={(e) => setPublicReplyTexts(e.target.value)} rows={3} className="rounded-lg border border-[#D0D5DD] p-2.5 text-sm" />
          </label>
        )}

        {error && <p className="text-sm font-medium text-[#B42318]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !responseText.trim()}
            className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
