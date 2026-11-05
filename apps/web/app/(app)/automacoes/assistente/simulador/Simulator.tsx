"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: { mediaType: string; data: string };
  actions?: string[];
  usage?: string;
}

interface Chat {
  id: string;
  title: string;
  profileName: string;
  leadContext: string;
  messages: Msg[];
  updatedAt: number;
}

const STORAGE = "milena_simulator_v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const newChat = (): Chat => ({ id: uid(), title: "Nova conversa", profileName: "", leadContext: "", messages: [], updatedAt: Date.now() });

function load(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE);
    const list = raw ? (JSON.parse(raw) as Chat[]) : [];
    return list.length ? list : [newChat()];
  } catch {
    return [newChat()];
  }
}

function save(list: Chat[]) {
  try {
    // Imagens ficam fora do armazenamento local (estouram o limite); o texto da conversa fica.
    localStorage.setItem(STORAGE, JSON.stringify(list.map((c) => ({ ...c, messages: c.messages.map(({ image, ...m }) => (image ? { ...m, content: m.content || "[imagem]" } : m)) }))));
  } catch {}
}

function readImage(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ mediaType: file.type, data: result.slice(result.indexOf(",") + 1) });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Simulator({ name, initialInstructions }: { name: string; initialInstructions: string }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<{ mediaType: string; data: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [savedInstructions, setSavedInstructions] = useState(initialInstructions);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = load();
    setChats(list);
    setActiveId(list[0]!.id);
  }, []);
  useEffect(() => {
    if (chats.length) save(chats);
  }, [chats]);

  const chat = chats.find((c) => c.id === activeId);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [chat?.messages.length, loading]);

  function patch(id: string, fn: (c: Chat) => Chat) {
    setChats((list) => list.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)));
  }

  async function generate(target: Chat, messages: Msg[]) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/assistant-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.map(({ role, content, image }) => ({ role, content, image })), profileName: target.profileName, leadContext: target.leadContext }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Falha ao gerar a resposta.");
      const bubbles: string[] = data.bubbles ?? [];
      const actions: string[] = data.actions ?? [];
      const u = data.usage ?? {};
      const usage = `${(u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)} tokens lidos (${u.cache_read_input_tokens ?? 0} do cache, mais baratos) · ${u.output_tokens ?? 0} escritos`;
      const replies: Msg[] = bubbles.map((content, i) => ({ id: uid(), role: "assistant", content, actions: i === bubbles.length - 1 && actions.length ? actions : undefined, usage: i === bubbles.length - 1 ? usage : undefined }));
      if (!replies.length && actions.length) replies.push({ id: uid(), role: "assistant", content: "(sem texto)", actions });
      patch(target.id, (c) => ({ ...c, messages: [...messages, ...replies] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar a resposta.");
    } finally {
      setLoading(false);
    }
  }

  function addLeadMessage(andReply: boolean) {
    if (!chat || loading || (!draft.trim() && !image)) return;
    const msg: Msg = { id: uid(), role: "user", content: draft.trim(), image: image ?? undefined };
    const messages = [...chat.messages, msg];
    const title = chat.messages.length ? chat.title : (chat.profileName || draft.trim().slice(0, 32) || "Conversa");
    patch(chat.id, (c) => ({ ...c, title, messages }));
    setDraft("");
    setImage(null);
    if (andReply) generate({ ...chat, title }, messages);
  }

  function regenerate() {
    if (!chat || loading) return;
    let end = chat.messages.length;
    while (end > 0 && chat.messages[end - 1]!.role === "assistant") end--;
    if (!end) return;
    generate(chat, chat.messages.slice(0, end));
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(id);
    setTimeout(() => setCopied(""), 1500);
  }

  function lastReplyText(): string {
    if (!chat) return "";
    const out: string[] = [];
    for (let i = chat.messages.length - 1; i >= 0 && chat.messages[i]!.role === "assistant"; i--) out.unshift(chat.messages[i]!.content);
    return out.join("\n\n");
  }

  async function saveInstructions() {
    setSavingInstructions(true);
    const response = await fetch("/api/admin/assistant-simulator", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraInstructions: instructions }) });
    setSavingInstructions(false);
    if (response.ok) setSavedInstructions(instructions);
    else setError((await response.json().catch(() => null))?.error ?? "Não consegui salvar os ajustes.");
  }

  function createChat() {
    const c = newChat();
    setChats((list) => [c, ...list]);
    setActiveId(c.id);
    setShowContext(false);
  }

  function removeChat(id: string) {
    setChats((list) => {
      const next = list.filter((c) => c.id !== id);
      const safe = next.length ? next : [newChat()];
      if (id === activeId) setActiveId(safe[0]!.id);
      return safe;
    });
  }

  const endsWithReply = chat?.messages.at(-1)?.role === "assistant";
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#101828] px-5 py-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Assistente virtual · modo teste</p>
          <h1 className="text-lg font-semibold">Simulador da {name}</h1>
          <p className="text-xs text-white/70">Cole a mensagem do lead, copie a resposta e envie você mesmo. Nada é enviado, agendado ou avisado daqui.</p>
        </div>
        <Link href="/automacoes/assistente" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/10">
          Voltar às configurações
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="rounded-2xl border border-[#E4E7EC] bg-white p-3">
          <button type="button" onClick={createChat} className="mb-3 w-full rounded-lg bg-[#101828] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D2939]">
            + Nova conversa
          </button>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {sorted.map((c) => (
              <li key={c.id} className={`group flex items-center rounded-lg ${c.id === activeId ? "bg-[#F2F4F7]" : "hover:bg-[#F9FAFB]"}`}>
                <button type="button" onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                  <span className="block truncate text-sm font-medium text-[#101828]">{c.title}</span>
                  <span className="text-xs text-[#667085]">{c.messages.length} mensagens</span>
                </button>
                <button type="button" onClick={() => removeChat(c.id)} title="Apagar" className="px-2 text-[#98A2B3] opacity-0 hover:text-[#D92D20] group-hover:opacity-100">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
          {chat && (
            <>
              <div className="border-b border-[#EEF0F3] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={chat.profileName}
                    onChange={(e) => patch(chat.id, (c) => ({ ...c, profileName: e.target.value }))}
                    placeholder="Nome do lead (como aparece no WhatsApp)"
                    className="min-w-0 flex-1 rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-sm"
                  />
                  <button type="button" onClick={() => setShowContext((v) => !v)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]">
                    {showContext ? "Ocultar contexto" : chat.leadContext ? "Contexto ✓" : "+ Contexto do lead"}
                  </button>
                </div>
                {showContext && (
                  <textarea
                    value={chat.leadContext}
                    onChange={(e) => patch(chat.id, (c) => ({ ...c, leadContext: e.target.value }))}
                    rows={3}
                    placeholder="Opcional: o que já se sabe (respostas do formulário, segmento, verba, cidade...)"
                    className="mt-2 w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm"
                  />
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-[#EFEAE2] px-4 py-4">
                {chat.messages.length === 0 && (
                  <div className="mx-auto mt-10 max-w-sm rounded-xl bg-white/80 p-4 text-center text-sm text-[#475467]">
                    Cole abaixo a primeira mensagem que o lead mandou. Se ele mandou várias, pode colar todas juntas.
                  </div>
                )}
                {chat.messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-start">
                      <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-sm text-[#101828] shadow-sm">
                        <p className="mb-0.5 text-[11px] font-semibold text-[#027A48]">{chat.profileName || "Lead"}</p>
                        {m.image && <img src={`data:${m.image.mediaType};base64,${m.image.data}`} alt="" className="mb-1 max-h-48 rounded-lg" />}
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex flex-col items-end gap-1">
                      <div className="group relative max-w-[80%] rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-sm text-[#101828] shadow-sm">
                        {editing === m.id ? (
                          <textarea
                            autoFocus
                            defaultValue={m.content}
                            onBlur={(e) => {
                              const value = e.target.value;
                              patch(chat.id, (c) => ({ ...c, messages: c.messages.map((x) => (x.id === m.id ? { ...x, content: value } : x)) }));
                              setEditing(null);
                            }}
                            rows={Math.max(2, Math.ceil(m.content.length / 40))}
                            className="w-72 max-w-full rounded border border-[#A6F4C5] bg-white p-1 text-sm"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                        <div className="mt-1 flex justify-end gap-2 text-[11px] text-[#475467]">
                          <button type="button" onClick={() => setEditing(m.id)} className="hover:text-[#101828]">
                            editar
                          </button>
                          <button type="button" onClick={() => copy(m.content, m.id)} className="font-medium text-[#027A48] hover:underline">
                            {copied === m.id ? "copiado!" : "copiar"}
                          </button>
                        </div>
                      </div>
                      {m.actions?.map((a, i) => (
                        <span key={i} className="max-w-[80%] rounded-full bg-[#FFFAEB] px-3 py-1 text-xs text-[#B54708] ring-1 ring-[#FEDF89]">
                          ⚙ {a}
                        </span>
                      ))}
                      {m.usage && <span className="text-[10px] text-[#98A2B3]">{m.usage}</span>}
                    </div>
                  ),
                )}
                {loading && (
                  <div className="flex justify-end">
                    <span className="rounded-xl bg-[#D9FDD3] px-3 py-2 text-sm text-[#475467]">{name} está digitando…</span>
                  </div>
                )}
                <div ref={bottom} />
              </div>

              {endsWithReply && !loading && (
                <div className="flex flex-wrap gap-2 border-t border-[#EEF0F3] bg-[#F9FAFB] px-4 py-2">
                  <button type="button" onClick={() => copy(lastReplyText(), "all")} className="rounded-lg bg-[#027A48] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#05603A]">
                    {copied === "all" ? "Copiado!" : "Copiar resposta inteira"}
                  </button>
                  <button type="button" onClick={regenerate} className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F2F4F7]">
                    Gerar outra versão
                  </button>
                  <span className="self-center text-xs text-[#667085]">Se você mudou o texto antes de enviar, clique em "editar" para a conversa ficar igual ao que o lead recebeu.</span>
                </div>
              )}

              {error && <p className="border-t border-[#FECDCA] bg-[#FEF3F2] px-4 py-2 text-xs text-[#B42318]">{error}</p>}

              <div className="border-t border-[#EEF0F3] p-3">
                {image && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-[#475467]">
                    <img src={`data:${image.mediaType};base64,${image.data}`} alt="" className="h-12 rounded" />
                    <button type="button" onClick={() => setImage(null)} className="text-[#D92D20]">
                      remover imagem
                    </button>
                  </div>
                )}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addLeadMessage(true);
                    }
                  }}
                  onPaste={async (e) => {
                    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
                    if (file) {
                      e.preventDefault();
                      setImage(await readImage(file));
                    }
                  }}
                  rows={3}
                  placeholder="Mensagem do lead (Enter gera a resposta, Shift+Enter quebra linha). Áudio: cole o que ele falou."
                  className="w-full resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" disabled={loading} onClick={() => addLeadMessage(true)} className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D2939] disabled:opacity-50">
                    Ver resposta da {name}
                  </button>
                  <button type="button" disabled={loading} onClick={() => addLeadMessage(false)} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50">
                    Só adicionar
                  </button>
                  <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB]">
                    Anexar imagem
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) setImage(await readImage(file));
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-3 rounded-2xl border border-[#E4E7EC] bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-[#101828]">Ajustes da {name}</h2>
            <p className="text-xs text-[#667085]">Não gostou de uma resposta? Escreva a regra aqui, salve e clique em "Gerar outra versão". Vale também para o WhatsApp de verdade.</p>
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={14}
            placeholder={'Ex.: "Quando perguntarem se atendemos fora de Americana, diga que sim, atendemos online."'}
            className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={savingInstructions || instructions === savedInstructions}
            onClick={saveInstructions}
            className="w-full rounded-lg bg-[#101828] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D2939] disabled:opacity-40"
          >
            {savingInstructions ? "Salvando…" : instructions === savedInstructions ? "Ajustes salvos" : "Salvar ajustes"}
          </button>
          <div className="rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#475467]">
            <p className="mb-1 font-semibold text-[#344054]">No modo teste</p>
            <p>Os horários vêm da agenda real, mas a reunião não é criada. Os avisos em amarelo mostram o que ela faria (agendar, chamar humano, pagamento). Faça isso você mesmo.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
