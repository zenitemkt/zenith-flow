"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Eraser, Instagram, MessageCircle, Search, Send, Trash2, User } from "lucide-react";
import { confirmDialog } from "@/lib/dialogs";

export interface InboxItem {
  key: string;
  channel: "WHATSAPP" | "INSTAGRAM" | "MESSENGER";
  name: string;
  sub: string;
  preview: string;
  lastAt: string;
  mode: "bot" | "human" | null;
  classification: string | null;
  account: string;
}

export interface InboxMessage {
  id: string;
  author: "contact" | "bot" | "team";
  text: string;
  at: string;
}

const CHANNELS = [
  { id: "todos", label: "Todos" },
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "MESSENGER", label: "Messenger" },
] as const;

const CHANNEL_STYLE = {
  WHATSAPP: { label: "WhatsApp", cls: "bg-[#ECFDF3] text-[#027A48]", Icon: MessageCircle },
  INSTAGRAM: { label: "Instagram", cls: "bg-[#FDF2FA] text-[#C11574]", Icon: Instagram },
  MESSENGER: { label: "Messenger", cls: "bg-[#EFF8FF] text-[#175CD3]", Icon: MessageCircle },
} as const;

const CLASS_LABEL: Record<string, string> = { icp: "No perfil", fora_icp: "Fora do perfil", vendedor: "Vendedor", indefinido: "Em triagem" };

function when(iso: string) {
  // Sempre no fuso de Brasília (servidor e navegador iguais, sem erro de hidratação).
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const sp = new Date(d.getTime() - 3 * 3600_000);
  return `${pad(sp.getUTCDate())}/${pad(sp.getUTCMonth() + 1)} ${pad(sp.getUTCHours())}:${pad(sp.getUTCMinutes())}`;
}

export function InboxView({ items, selected, messages, channel }: { items: InboxItem[]; selected: string | null; messages: InboxMessage[]; channel: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Atualiza sozinho a cada 10 s para acompanhar a conversa ao vivo.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    // Chrome novo devolve uma Promise aqui; com chaves o efeito não retorna nada.
    void endRef.current?.scrollIntoView({ block: "end" });
  }, [selected, messages.length]);

  const q = query.trim().toLowerCase();
  const list = items.filter((i) => (channel === "todos" || i.channel === channel) && (!q || `${i.name} ${i.sub} ${i.preview}`.toLowerCase().includes(q)));
  const current = items.find((i) => i.key === selected) ?? null;
  const href = (params: { c?: string | null; canal?: string }) => {
    const sp = new URLSearchParams();
    const canal = params.canal ?? channel;
    if (canal !== "todos") sp.set("canal", canal);
    const c = params.c === undefined ? selected : params.c;
    if (c) sp.set("c", c);
    const s = sp.toString();
    return `/conversas${s ? `?${s}` : ""}`;
  };

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: selected, ...payload }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Não foi possível concluir.");
      return false;
    }
    router.refresh();
    return true;
  }

  const [connectResult, setConnectResult] = useState<string | null>(null);
  async function connectMessenger() {
    setBusy(true);
    setConnectResult(null);
    const res = await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect-messenger" }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    setConnectResult(res.ok ? (body?.results ?? []).join("\n") : body?.error ?? "Não foi possível ligar.");
  }

  async function clearHistory() {
    if (!(await confirmDialog("Apagar todas as mensagens desta conversa? O contato continua na lista. Isso não apaga nada no celular do contato.", { title: "Apagar histórico", confirmLabel: "Apagar histórico", danger: true }))) return;
    await post({ action: "clear" });
  }

  async function deleteConversation() {
    if (!(await confirmDialog("Apagar esta conversa inteira? Some da lista junto com as mensagens e as reuniões marcadas por ela. Se o contato escrever de novo, começa do zero.", { title: "Apagar conversa", confirmLabel: "Apagar conversa", danger: true }))) return;
    if (await post({ action: "delete" })) router.push(href({ c: null }));
  }

  async function send() {
    if (!text.trim() || busy) return;
    if (await post({ text })) setText("");
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[520px] overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
      <aside className={`${current ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[#EEF0F3] md:w-80 md:shrink-0`}>
        <div className="flex flex-col gap-2 border-b border-[#EEF0F3] p-3">
          <p className="text-sm font-semibold text-[#101828]">Conversas</p>
          <label className="flex items-center gap-2 rounded-lg border border-[#D0D5DD] px-2.5">
            <Search size={14} className="text-[#98A2B3]" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, número ou texto" className="h-9 w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="flex flex-wrap gap-1">
            {CHANNELS.map((c) => (
              <Link key={c.id} href={href({ canal: c.id, c: null })} className={`rounded-md px-2 py-1 text-xs font-medium ${channel === c.id ? "bg-[#101828] text-white" : "border border-[#E4E7EC] text-[#475467]"}`}>
                {c.label}
              </Link>
            ))}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list.length === 0 && channel !== "MESSENGER" && <li className="p-4 text-center text-xs text-[#98A2B3]">Nenhuma conversa.</li>}
          {channel === "MESSENGER" && (
            <li className="flex flex-col gap-2 p-4 text-center text-xs text-[#667085]">
              {list.length === 0 && <span>Nenhuma conversa do Messenger ainda.</span>}
              <button type="button" disabled={busy} onClick={() => void connectMessenger()} className="mx-auto rounded-lg border border-[#D0D5DD] px-3 py-1.5 font-semibold text-[#344054] disabled:opacity-60">
                {busy ? "Ligando..." : "Ligar mensagens do Messenger"}
              </button>
              {connectResult && <span className="whitespace-pre-line text-left">{connectResult}</span>}
            </li>
          )}
          {list.map((i) => {
            const st = CHANNEL_STYLE[i.channel];
            return (
              <li key={i.key}>
                <Link href={href({ c: i.key })} className={`flex flex-col gap-1 border-b border-[#F2F4F7] px-3 py-2.5 hover:bg-[#F9FAFB] ${i.key === selected ? "bg-[#FFF4ED]" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${st.cls}`}>
                      <st.Icon size={13} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#101828]">{i.name}</span>
                    <span className="shrink-0 text-[11px] text-[#98A2B3]">{when(i.lastAt)}</span>
                  </div>
                  <p className="truncate pl-8 text-xs text-[#667085]">{i.preview}</p>
                  <div className="flex flex-wrap gap-1 pl-8">
                    <span className="text-[10px] text-[#98A2B3]">{i.account}</span>
                    {i.mode && <span className={`rounded-full px-1.5 text-[10px] font-medium ${i.mode === "bot" ? "bg-[#FFF4ED] text-[#C42100]" : "bg-[#F2F4F7] text-[#344054]"}`}>{i.mode === "bot" ? "Milena" : "Equipe"}</span>}
                    {i.classification && <span className="rounded-full bg-[#EFF8FF] px-1.5 text-[10px] text-[#175CD3]">{CLASS_LABEL[i.classification] ?? i.classification}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={`${current ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!current ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#98A2B3]">Escolha uma conversa à esquerda.</div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-[#EEF0F3] px-4 py-3">
              <Link href={href({ c: null })} className="text-xs text-[#667085] md:hidden">← Voltar</Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#101828]">{current.name}</p>
                <p className="truncate text-xs text-[#667085]">
                  {CHANNEL_STYLE[current.channel].label} · {current.account} {current.sub && `· ${current.sub}`}
                </p>
              </div>
              <button type="button" disabled={busy} onClick={() => void clearHistory()} title="Apagar histórico" aria-label="Apagar histórico" className="rounded-lg border border-[#D0D5DD] p-1.5 text-[#667085] hover:text-[#B42318] disabled:opacity-60">
                <Eraser size={15} aria-hidden />
              </button>
              <button type="button" disabled={busy} onClick={() => void deleteConversation()} title="Apagar conversa" aria-label="Apagar conversa" className="rounded-lg border border-[#D0D5DD] p-1.5 text-[#667085] hover:text-[#B42318] disabled:opacity-60">
                <Trash2 size={15} aria-hidden />
              </button>
              {current.mode && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void post({ action: "mode", mode: current.mode === "bot" ? "human" : "bot" })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${current.mode === "bot" ? "border border-[#D0D5DD] text-[#344054]" : "bg-[#FF2B00] text-white"}`}
                >
                  {current.mode === "bot" ? "Assumir conversa" : "Devolver para a Milena"}
                </button>
              )}
            </header>
            <div className="flex-1 overflow-y-auto bg-[#F9FAFB] px-4 py-3">
              <div className="flex flex-col gap-1.5">
                {messages.map((m) => {
                  const mine = m.author !== "contact";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.author === "contact" ? "bg-white text-[#101828] ring-1 ring-[#EEF0F3]" : m.author === "bot" ? "bg-[#FFF4ED] text-[#101828] ring-1 ring-[#FED7C3]" : "bg-[#101828] text-white"}`}>
                        {mine && (
                          <span className={`mb-0.5 flex items-center gap-1 text-[10px] font-semibold ${m.author === "bot" ? "text-[#C42100]" : "text-white/70"}`}>
                            {m.author === "bot" ? <Bot size={11} aria-hidden /> : <User size={11} aria-hidden />}
                            {m.author === "bot" ? (current.channel === "WHATSAPP" ? "Milena" : "Automação") : "Equipe"}
                          </span>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <span className={`mt-0.5 block text-right text-[10px] ${m.author === "team" ? "text-white/60" : "text-[#98A2B3]"}`}>{when(m.at)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            </div>
            <footer className="border-t border-[#EEF0F3] p-3">
              {error && <p className="mb-2 rounded-lg bg-[#FEF3F2] px-3 py-1.5 text-xs text-[#B42318]">{error}</p>}
              {current.mode === "bot" && <p className="mb-2 text-[11px] text-[#667085]">A Milena está respondendo. Se você mandar mensagem, a conversa passa para a equipe.</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  placeholder="Escreva a resposta (Enter envia, Shift+Enter quebra linha)"
                  className="min-w-0 flex-1 resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00]"
                />
                <button type="button" disabled={busy || !text.trim()} onClick={() => void send()} className="flex h-10 items-center gap-1.5 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:opacity-60">
                  <Send size={15} aria-hidden />
                  Enviar
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
