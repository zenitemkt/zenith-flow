"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import type { FlowStep } from "@/lib/instagram-flow-model";
import { FlowEditor, FlowPreview, messageStep } from "./FlowEditor";

interface Button {
  text: string;
  url: string;
}

interface Rule {
  id: string;
  triggerType: string;
  keyword: string | null;
  responseText: string;
  buttons: Button[];
  mediaId: string | null;
  mediaCaption: string | null;
  mediaPermalink: string | null;
  publicReplyTexts: string[];
  flow: FlowStep[] | null;
  active: boolean;
}

interface Contact {
  id: string;
  username: string | null;
  name: string | null;
  tags: string[];
  fields: Record<string, string>;
  lastInboundAt: string | null;
  lastSession: { status: string; keyword: string | null; triggerType: string } | null;
}

const SESSION_LABELS: Record<string, string> = {
  running: "na sequência",
  waiting_delay: "aguardando atraso",
  waiting_input: "aguardando resposta",
  waiting_reply: "aguardando resposta",
  done: "concluiu",
  expired: "expirou (24h)",
  failed: "falhou",
};

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
  return { triggerType, keyword: "", responseText: "", buttons: [], mediaId: null, mediaCaption: null, mediaPermalink: null, publicReplyTexts: [], flow: null };
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
  const [tokenInput, setTokenInput] = useState("");
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

  async function saveMessagingToken() {
    if (!tokenInput.trim()) return;
    setSubscribing(true);
    setSubscribeMsg(null);
    const response = await fetch("/api/instagram-rules/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId, accessToken: tokenInput.trim() }),
    });
    setSubscribing(false);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setSubscribeMsg(body?.error ?? "Falha ao salvar o token.");
    } else {
      setTokenInput("");
      setSubscribeMsg(`Token salvo pra @${body.username}${body.longLived ? " (trocado por um de 60 dias)" : " (não foi possível trocar por um de longa duração ainda)"}.`);
    }
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
        <label className="flex min-w-72 flex-1 flex-col gap-1 text-xs font-medium text-[#475467]">
          Token de mensageria do Instagram (IGAA...)
          <input
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="Cole aqui o token gerado no painel da Meta"
            className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm font-mono"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveMessagingToken}
            disabled={subscribing || !tokenInput.trim()}
            className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subscribing ? "Salvando..." : "Salvar token"}
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
                      {rule.flow && rule.flow.length > 1 && (
                        <span className="rounded-full bg-[#FFF4F2] px-2 py-0.5 text-xs font-medium text-[#FF2B00]">sequência · {rule.flow.length} passos</span>
                      )}
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

      <ContactsSection clientId={selectedClientId} />

      <RuleFormModal
        open={creatingTrigger !== null || editing !== null}
        clientId={selectedClientId}
        initial={editing ?? (creatingTrigger ? { id: "", active: true, ...emptyDraft(creatingTrigger) } : null)}
        isEditing={editing !== null}
        instagramUsername={instagramUsername}
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

function ContactsSection({ clientId }: { clientId: string }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [tag, setTag] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      const query = tag.trim() ? `&tag=${encodeURIComponent(tag.trim())}` : "";
      fetch(`/api/instagram-rules/contacts?clientId=${clientId}${query}`)
        .then((r) => (r.ok ? r.json() : { contacts: [] }))
        .then((body) => setContacts(body.contacts ?? []))
        .catch(() => setContacts([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [clientId, tag]);

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#101828]">Contatos</h2>
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Filtrar por etiqueta" className="h-8 rounded-lg border border-[#D0D5DD] px-3 text-xs" />
      </div>
      {contacts === null ? (
        <p className="py-4 text-center text-sm text-[#98A2B3]">Carregando...</p>
      ) : contacts.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#98A2B3]">Ninguém conversou com o mini-chat ainda{tag.trim() ? " com essa etiqueta" : ""}.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[#EEF0F3]">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#101828]">
                  {contact.username ? `@${contact.username}` : (contact.name ?? "Sem nome")}
                  {contact.username && contact.name && <span className="ml-1.5 font-normal text-[#667085]">{contact.name}</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {contact.tags.map((t) => (
                    <span key={t} className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#344054]">
                      {t}
                    </span>
                  ))}
                  {Object.entries(contact.fields).map(([key, value]) => (
                    <span key={key} className="rounded-full bg-[#FFF4ED] px-2 py-0.5 text-xs text-[#B93815]">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              </div>
              {contact.lastSession && (
                <span className="shrink-0 text-xs text-[#667085]">
                  {SESSION_LABELS[contact.lastSession.status] ?? contact.lastSession.status} ·{" "}
                  {contact.lastSession.keyword ? `"${contact.lastSession.keyword}"` : "pega-tudo"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function initialSteps(rule: Rule | null): FlowStep[] {
  if (rule?.flow && rule.flow.length > 0) return rule.flow;
  return [messageStep(rule?.responseText ?? "", rule?.buttons ?? [])];
}

function RuleFormModal({
  open,
  clientId,
  initial,
  isEditing,
  instagramUsername,
  onClose,
  onSaved,
}: {
  open: boolean;
  clientId: string;
  initial: Rule | null;
  isEditing: boolean;
  instagramUsername: string | null;
  onClose: () => void;
  onSaved: (rule: Rule, isNew: boolean) => void;
}) {
  const [triggerType, setTriggerType] = useState(initial?.triggerType ?? "direct_message");
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [steps, setSteps] = useState<FlowStep[]>(() => initialSteps(initial));
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
    setSteps(initialSteps(initial));
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
      flow: steps,
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

  const chip = (active: boolean) =>
    `flex h-10 w-full items-center rounded-lg border px-3 text-left text-sm font-semibold transition ${
      active ? "border-[#FF2B00] bg-[#FFF1EC] text-[#FF2B00]" : "border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB]"
    }`;
  const fieldClass = "h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";
  const canSave = steps[0]?.type === "message" && Boolean(steps[0].text.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar regra" : "Nova regra"}
      description="Defina quando a regra dispara e monte a conversa. A prévia ao lado mostra o caminho principal."
      size="full"
    >
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Gatilho */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Gatilho</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#475467]">Quando a pessoa</span>
                {isEditing ? (
                  <span className={chip(true)}>{TRIGGER_LABELS[triggerType]}</span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setTriggerType(value)} className={chip(triggerType === value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-medium text-[#475467]">
                Com a palavra-chave
                <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Vazio = qualquer mensagem" className={fieldClass} />
                <span className="font-normal text-[#98A2B3]">Basta a mensagem conter a palavra, sem diferenciar maiúsculas.</span>
              </label>

              {triggerType === "comment" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[#475467]">Em qual post</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => setMediaScope("any")} className={chip(mediaScope === "any")}>
                      Qualquer
                    </button>
                    <button type="button" onClick={() => setMediaScope("specific")} className={chip(mediaScope === "specific")}>
                      Específico
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
                      className={fieldClass}
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
            </div>
          </div>

          {triggerType === "comment" && (
            <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Resposta pública</p>
              <p className="mb-2 text-xs text-[#667085]">Uma por linha. Sorteia uma a cada comentário, pra não repetir sempre a mesma frase.</p>
              <textarea
                value={publicReplyTexts}
                onChange={(e) => setPublicReplyTexts(e.target.value)}
                rows={4}
                placeholder={"Te mandei no direct!\nOlha sua DM 😉"}
                className="w-full rounded-lg border border-[#D0D5DD] bg-white p-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
              />
            </div>
          )}
        </aside>

        {/* Conversa */}
        <section className="min-w-0">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Conversa na DM</p>
          <FlowEditor steps={steps} onChange={setSteps} triggerType={triggerType} />
        </section>

        {/* Prévia */}
        <aside className="hidden xl:sticky xl:top-0 xl:block xl:self-start">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Prévia</p>
          <FlowPreview steps={steps} username={instagramUsername} />
        </aside>
      </div>

      <div className="sticky -bottom-4 z-10 -mx-5 -mb-4 mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[#EEF0F3] bg-white px-5 py-3">
        {error && <p className="mr-auto text-sm font-medium text-[#B42318]">{error}</p>}
        <span className="text-xs text-[#98A2B3]">
          {steps.length} {steps.length === 1 ? "passo" : "passos"}
        </span>
        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !canSave}
          className="h-10 rounded-lg bg-[#FF2B00] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar regra"}
        </button>
      </div>
    </Modal>
  );
}
