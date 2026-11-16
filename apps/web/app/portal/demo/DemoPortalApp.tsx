"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toDataURL } from "qrcode";
import { CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, Download, FileText, Film, ImageIcon, Link2, MapPin, Paperclip, PencilLine, QrCode, Receipt, RotateCcw, Type, X } from "lucide-react";
import { PageHeader, ghostButtonClass, inputClass, panelClass, primaryButtonClass, rowClass } from "../_components/ui";
import type { DemoRealArtSet } from "@/lib/portal-demo";
import { DEMO_TRAFFIC, buildDemoState, demoArtSignature, leadsByMonth, localDate, localDateTime, type DemoCampaign, type DemoInvoice, type DemoPost, type DemoRequest, type DemoState, type PostStatus, type RequestStatus, type TrafficPeriod } from "./demo-data";

const DemoMap = dynamic(() => import("./DemoMap").then((m) => m.DemoMap), { ssr: false, loading: () => <div className="h-[380px] animate-pulse rounded-2xl bg-white/[0.04]" /> });

const STORAGE_KEY = "zf-portal-demo-v3";
const SITE_URL = "https://hubzenite.com.br";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => v.toLocaleString("pt-BR");
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const todayIso = () => localDate(new Date());
/** "AAAA-MM-DDTHH:mm" → "seg, 18/11 às 10:00". */
const when = (at: string) => {
  const d = new Date(`${at}:00`);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${wd}, ${at.slice(8, 10)}/${at.slice(5, 7)} às ${at.slice(11, 16)}`;
};
type Update = (fn: (s: DemoState) => DemoState) => void;

/** Estado da demonstração: só no navegador; "Resetar painel" volta ao original. */
function useDemoState(art?: DemoRealArtSet) {
  const [state, setState] = useState<DemoState | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DemoState;
        if (parsed?.version === 3 && parsed.artSig === demoArtSignature(art)) {
          setState(parsed);
          return;
        }
      }
    } catch {
      /* sem armazenamento: usa o original */
    }
    setState(buildDemoState(new Date(), art));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as artes vêm do servidor uma vez por carregamento
  }, []);
  const update: Update = (fn) =>
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignora */
      }
      return next;
    });
  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignora */
    }
    setState(buildDemoState(new Date(), art));
  };
  return { state, update, reset };
}

function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`${panelClass} max-h-[90vh] w-full overflow-y-auto p-5 ${wide ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#F5F2EE]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-[#A3A5B2] hover:bg-white/[0.06]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type Tone = "green" | "orange" | "blue" | "gray" | "yellow" | "red";
function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cls = {
    green: "bg-[#12B76A]/15 text-[#6CE9A6]",
    orange: "bg-[#FF7A1A]/15 text-[#FF9C55]",
    blue: "bg-[#2E90FA]/15 text-[#84CAFF]",
    gray: "bg-white/[0.06] text-[#A3A5B2]",
    yellow: "bg-[#FDB022]/15 text-[#FEC84B]",
    red: "bg-[#F04438]/15 text-[#FDA29B]",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${rowClass} p-4`}>
      <p className="text-xs text-[#8B8D9A]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#F5F2EE]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#6CE9A6]">{hint}</p>}
    </div>
  );
}

/* ---------------- Publicações (aprovação, agendamento) ---------------- */
const POST_STATUS: Record<PostStatus, { tone: Tone; label: string; chip: string }> = {
  published: { tone: "green", label: "Publicado", chip: "bg-[#12B76A]/15 text-[#6CE9A6] hover:bg-[#12B76A]/25" },
  scheduled: { tone: "blue", label: "Agendado", chip: "bg-[#2E90FA]/15 text-[#84CAFF] hover:bg-[#2E90FA]/25" },
  pending: { tone: "orange", label: "Aguardando aprovação", chip: "bg-[#FF7A1A]/15 text-[#FF9C55] hover:bg-[#FF7A1A]/25" },
  changes: { tone: "yellow", label: "Em ajuste", chip: "bg-[#FDB022]/15 text-[#FEC84B] hover:bg-[#FDB022]/25" },
};
const statusIcon = (st: PostStatus, size = 12) => (st === "published" ? <CheckCircle2 size={size} className="shrink-0" /> : st === "scheduled" ? <Clock size={size} className="shrink-0" /> : st === "pending" ? <CalendarClock size={size} className="shrink-0" /> : <PencilLine size={size} className="shrink-0" />);

function PostBadge({ status }: { status: PostStatus }) {
  return (
    <Badge tone={POST_STATUS[status].tone}>
      {statusIcon(status)} {POST_STATUS[status].label}
    </Badge>
  );
}

/** Detalhe de uma publicação: aprovar, pedir ajuste na arte, alterar legenda ou mudar data e hora (agendado: só a data). */
function PostDetail({ post, update, onClose }: { post: DemoPost; update: Update; onClose: () => void }) {
  const [mode, setMode] = useState<null | "art" | "caption" | "date">(post.status === "scheduled" ? "date" : null);
  const [text, setText] = useState("");
  const [date, setDate] = useState(post.at.slice(0, 10));
  const [time, setTime] = useState(post.at.slice(11, 16));
  const [saved, setSaved] = useState(false);
  const patch = (fn: (p: DemoPost) => DemoPost) => update((st) => ({ ...st, posts: st.posts.map((p) => (p.id === post.id ? fn(p) : p)) }));
  const open = (m: "art" | "caption" | "date") => {
    setMode(m);
    setSaved(false);
    setText(m === "caption" ? post.caption : "");
  };
  const approve = () => {
    patch((p) => ({ ...p, status: "scheduled" }));
    onClose();
  };
  const requestChange = () => {
    if (!text.trim()) return;
    patch((p) => ({ ...p, status: "changes", ...(mode === "art" ? { artNote: text.trim() } : { captionNote: text.trim() }) }));
    onClose();
  };
  const applyDate = () => {
    if (!date || !time) return;
    patch((p) => ({ ...p, at: `${date}T${time}` }));
    setSaved(true);
    if (post.status === "pending") setMode(null);
  };
  const editable = post.status === "pending" || post.status === "scheduled";
  const story = post.kind === "STORIE";

  return (
    <div className={`grid gap-5 ${story ? "md:grid-cols-[minmax(0,240px)_1fr]" : "md:grid-cols-2"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.image} alt="" className={`w-full rounded-2xl ${story ? "mx-auto max-w-[240px]" : ""}`} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PostBadge status={post.status} />
          <Badge tone="gray">{post.kind === "FEED" ? "Feed" : "Story"}</Badge>
        </div>
        <p className="text-xs text-[#8B8D9A]">
          {post.channel} · {post.status === "published" ? "publicado" : "publicação"} {when(post.at)}
        </p>
        <div>
          <p className="mb-1 text-xs font-medium text-[#8B8D9A]">{post.status === "pending" ? "Legenda sugerida" : "Legenda"}</p>
          <p className="whitespace-pre-line rounded-2xl bg-white/[0.03] p-3 text-sm text-[#D6D3CF]">{post.caption}</p>
        </div>

        {post.status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButtonClass} onClick={approve}>
              <Check size={16} /> Aprovar
            </button>
            <button type="button" className={`${ghostButtonClass} ${mode === "art" ? "border-[#FF2B00]" : ""}`} onClick={() => open("art")}>
              <PencilLine size={15} /> Pedir ajuste
            </button>
            <button type="button" className={`${ghostButtonClass} ${mode === "caption" ? "border-[#FF2B00]" : ""}`} onClick={() => open("caption")}>
              <Type size={15} /> Alterar legenda
            </button>
            <button type="button" className={`${ghostButtonClass} ${mode === "date" ? "border-[#FF2B00]" : ""}`} onClick={() => open("date")}>
              <CalendarClock size={15} /> Mudar data
            </button>
          </div>
        )}

        {post.status === "pending" && (mode === "art" || mode === "caption") && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-[#D6D3CF]" htmlFor="demo-change">
              {mode === "art" ? "O que você quer mudar na arte?" : "Edite a legenda ou escreva o que mudar"}
            </label>
            <textarea id="demo-change" value={text} onChange={(e) => setText(e.target.value)} rows={mode === "caption" ? 6 : 3} placeholder={mode === "art" ? "Ex.: trocar a foto, aumentar o logo, usar a cor azul" : ""} className={`${inputClass} py-2`} autoFocus />
            <button type="button" className={primaryButtonClass} onClick={requestChange} disabled={!text.trim()}>
              {mode === "art" ? "Enviar pedido de ajuste" : "Enviar alteração da legenda"}
            </button>
          </div>
        )}

        {editable && mode === "date" && (
          <div className={`${rowClass} flex flex-col gap-2 p-3`}>
            <p className="text-sm font-medium text-[#D6D3CF]">{post.status === "scheduled" ? "Já aprovado. Você pode mudar a data de publicação:" : "Nova data e hora de publicação"}</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} className={`${inputClass} h-10`} aria-label="Data" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} h-10 w-[110px]`} aria-label="Hora" />
            </div>
            <button type="button" className={ghostButtonClass} onClick={applyDate} disabled={!date || !time || `${date}T${time}` === post.at}>
              Aplicar nova data
            </button>
          </div>
        )}
        {saved && <p className="text-sm text-[#6CE9A6]">Data alterada para {when(`${date}T${time}`)}.</p>}

        {post.status === "changes" && (
          <div className={`${rowClass} flex flex-col gap-1 p-3 text-sm`}>
            <p className="text-[#D6D3CF]">A equipe está ajustando e vai mandar de novo para sua aprovação.</p>
            {post.artNote && <p className="text-[#A3A5B2]">Ajuste na arte: {post.artNote}</p>}
            {post.captionNote && <p className="whitespace-pre-line text-[#A3A5B2]">Legenda pedida: {post.captionNote}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, onOpen }: { post: DemoPost; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`${panelClass} flex w-full flex-col overflow-hidden text-left transition-colors hover:border-white/20`}>
      <div className="aspect-[4/5] w-full overflow-hidden bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.image} alt="" className={`h-full w-full ${post.kind === "STORIE" ? "object-contain" : "object-cover"}`} />
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <p className="line-clamp-2 text-sm font-semibold">{post.title}</p>
        <p className="text-xs text-[#8B8D9A]">
          {post.channel} · {when(post.at)}
        </p>
        <div>
          <PostBadge status={post.status} />
        </div>
      </div>
    </button>
  );
}

/* ---------------- Início ---------------- */
function Home({ s, update }: { s: DemoState; update: Update }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const nowKey = localDateTime(new Date());
  const pending = s.posts.filter((p) => p.status === "pending").sort((a, b) => a.at.localeCompare(b.at));
  const upcoming = s.posts.filter((p) => p.status === "scheduled" && p.at >= nowKey).sort((a, b) => a.at.localeCompare(b.at));
  const openRequests = [...s.requests, ...s.graphics].filter((r) => r.status !== "done");
  const monthKey = todayIso().slice(0, 7);
  const publishedThisMonth = s.posts.filter((p) => p.status === "published" && p.at.startsWith(monthKey)).length;
  const current = openId ? s.posts.find((p) => p.id === openId) : null;
  const carousel = pending.length > 3;
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.9, behavior: "smooth" });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Olá! Aqui está tudo do seu marketing" description="Aprove as artes, acompanhe o calendário, os anúncios e os pagamentos num lugar só." />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              Esperando sua aprovação {pending.length > 0 && <Badge tone="orange">{pending.length}</Badge>}
            </h2>
            <p className="text-sm text-[#8B8D9A]">Toque numa arte para aprovar, pedir ajuste, alterar a legenda ou mudar a data.</p>
          </div>
          {carousel && (
            <div className="flex gap-2">
              <button type="button" className={`${ghostButtonClass} w-10 px-0`} onClick={() => scroll(-1)} aria-label="Anteriores">
                <ChevronLeft size={18} />
              </button>
              <button type="button" className={`${ghostButtonClass} w-10 px-0`} onClick={() => scroll(1)} aria-label="Próximas">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
        {pending.length === 0 ? (
          <div className={`${panelClass} flex items-center gap-3 p-5`}>
            <CheckCircle2 size={20} className="text-[#6CE9A6]" />
            <p className="text-sm text-[#D6D3CF]">Tudo aprovado! Assim que a equipe mandar novas artes, elas aparecem aqui.</p>
          </div>
        ) : carousel ? (
          <div ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {pending.map((p) => (
              <div key={p.id} className="w-[78%] shrink-0 snap-start sm:w-[calc((100%-16px)/2)] lg:w-[calc((100%-48px)/4)]">
                <PostCard post={p} onOpen={() => setOpenId(p.id)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pending.map((p) => (
              <PostCard key={p.id} post={p} onOpen={() => setOpenId(p.id)} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/portal/calendario" className={`${rowClass} p-4 hover:border-white/20`}>
          <p className="text-xs text-[#8B8D9A]">Próximas publicações agendadas</p>
          <p className="mt-1 text-3xl font-semibold text-[#84CAFF]">{upcoming.length}</p>
        </Link>
        <Link href="/portal/calendario" className={`${rowClass} p-4 hover:border-white/20`}>
          <p className="text-xs text-[#8B8D9A]">Publicados neste mês</p>
          <p className="mt-1 text-3xl font-semibold text-[#6CE9A6]">{publishedThisMonth}</p>
        </Link>
        <Link href="/portal/solicitacoes" className={`${rowClass} p-4 hover:border-white/20`}>
          <p className="text-xs text-[#8B8D9A]">Solicitações em aberto</p>
          <p className="mt-1 text-3xl font-semibold text-[#F5F2EE]">{openRequests.length}</p>
        </Link>
      </div>

      <section className={`${panelClass} p-5`}>
        <h2 className="mb-3 text-base font-semibold">Próximas publicações</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[#8B8D9A]">Nada agendado. Aprove as artes para elas entrarem aqui.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, 6).map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => setOpenId(u.id)} className={`${rowClass} flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:border-white/20`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.title}</p>
                    <p className="text-xs text-[#8B8D9A]">{u.channel}</p>
                  </div>
                  <Badge tone="blue">
                    <Clock size={12} /> {when(u.at)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current && (
        <Modal key={current.id} title={current.title} onClose={() => setOpenId(null)} wide>
          <PostDetail post={current} update={update} onClose={() => setOpenId(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Calendário ---------------- */
function Calendar({ s, update }: { s: DemoState; update: Update }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const monthKey = localDate(cursor).slice(0, 7);
  const monthPosts = s.posts.filter((p) => p.at.startsWith(monthKey)).sort((a, b) => a.at.localeCompare(b.at));
  const first = cursor.getDay();
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1);
  const iso = (d: number) => `${monthKey}-${String(d).padStart(2, "0")}`;
  const current = openId ? s.posts.find((p) => p.id === openId) : null;
  const count = (st: PostStatus) => monthPosts.filter((p) => p.status === st).length;
  const today = todayIso();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendário"
        description="Todo o planejamento do mês: o que já foi ao ar, o que está agendado e o que espera sua aprovação. Clique num post para ver."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className={`${ghostButtonClass} w-10 px-0`} aria-label="Mês anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[150px] text-center text-sm font-medium capitalize">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
            <button type="button" className={`${ghostButtonClass} w-10 px-0`} aria-label="Próximo mês" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 text-xs">
        {(["published", "scheduled", "pending", "changes"] as const).map((st) => (
          <Badge key={st} tone={POST_STATUS[st].tone}>
            {statusIcon(st)} {POST_STATUS[st].label} ({count(st)})
          </Badge>
        ))}
      </div>
      <div className={`${panelClass} overflow-x-auto p-3`}>
        <div className="grid min-w-[820px] grid-cols-7 gap-1 text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="px-2 py-1 text-[#8B8D9A]">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const valid = d >= 1 && d <= days;
            const dayItems = valid ? monthPosts.filter((p) => p.at.startsWith(iso(d))) : [];
            const isToday = valid && iso(d) === today;
            return (
              <div key={i} className={`min-h-[104px] rounded-xl p-1.5 ${valid ? "bg-white/[0.025]" : ""} ${isToday ? "ring-1 ring-[#FF2B00]/60" : ""}`}>
                {valid && <p className={`mb-1 text-[11px] ${isToday ? "font-semibold text-[#FF8A3D]" : "text-[#8B8D9A]"}`}>{d}</p>}
                {dayItems.map((p) => (
                  <button key={p.id} type="button" onClick={() => setOpenId(p.id)} title={`${p.at.slice(11, 16)} ${p.title} · ${POST_STATUS[p.status].label}`} className={`mb-1 flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-[11px] transition-colors ${POST_STATUS[p.status].chip}`}>
                    {statusIcon(p.status)}
                    <span className="shrink-0 font-semibold tabular-nums">{p.at.slice(11, 16)}</span>
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {monthPosts.length === 0 && <p className="text-sm text-[#8B8D9A]">O planejamento deste mês ainda não foi montado.</p>}
      {current && (
        <Modal key={current.id} title={current.title} onClose={() => setOpenId(null)} wide>
          <PostDetail post={current} update={update} onClose={() => setOpenId(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Solicitações (digitais e peças gráficas) ---------------- */
const REQ_STATUS: Record<RequestStatus, { tone: Tone; label: string }> = {
  waiting: { tone: "orange", label: "Aguardando" },
  progress: { tone: "blue", label: "Em andamento" },
  done: { tone: "green", label: "Concluída" },
};
const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function QuoteBadge({ r }: { r: DemoRequest }) {
  if (!r.quote) return r.status === "waiting" ? <Badge tone="gray">Aguardando cotação</Badge> : null;
  if (r.quote.status === "pending") return <Badge tone="yellow">Cotação para aprovar: {brl(r.quote.amount)}</Badge>;
  if (r.quote.status === "declined") return <Badge tone="red">Impressão recusada</Badge>;
  return <Badge tone="gray">Impressão aprovada: {brl(r.quote.amount)}</Badge>;
}

function Requests({ s, update, initial }: { s: DemoState; update: Update; initial: "requests" | "graphics" }) {
  const [section, setSection] = useState(initial);
  const [filter, setFilter] = useState<"all" | RequestStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<{ name: string; size: string }[]>([]);
  const isGraphic = section === "graphics";
  const list = s[section];
  const shown = filter === "all" ? list : list.filter((r) => r.status === filter);
  const current = openId ? list.find((r) => r.id === openId) : null;
  const patch = (id: string, fn: (r: DemoRequest) => DemoRequest) => update((st) => ({ ...st, [section]: st[section].map((r) => (r.id === id ? fn(r) : r)) }));

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDeadline("");
    setLinks("");
    setFiles([]);
  };
  const create = () => {
    if (!title.trim()) return;
    const ticket = Math.max(15002, ...s.requests.map((r) => r.ticket), ...s.graphics.map((r) => r.ticket)) + 1;
    const urls = links
      .split(/\s+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (/^https?:\/\//i.test(l) ? l : `https://${l}`));
    const updates = [{ at: todayIso(), author: "Você", text: "Pedido aberto." }];
    if (isGraphic) updates.push({ at: todayIso(), author: "Equipe Zenite", text: "Recebemos! Vamos cotar a impressão com a gráfica e mandar o valor aqui para você aprovar." });
    const item: DemoRequest = { id: `n${Date.now()}`, ticket, title: title.trim(), description: description.trim(), status: "waiting", createdAt: todayIso(), deadline: deadline || undefined, links: urls, attachments: files, updates };
    update((st) => ({ ...st, [section]: [item, ...st[section]] }));
    setCreating(false);
    resetForm();
    setFilter("all");
  };
  const decideQuote = (r: DemoRequest, approved: boolean) =>
    patch(r.id, (x) => ({
      ...x,
      status: approved ? "progress" : "done",
      quote: x.quote ? { ...x.quote, status: approved ? "approved" : "declined" } : x.quote,
      updates: [...x.updates, { at: todayIso(), author: "Você", text: approved ? "Impressão aprovada." : "Impressão recusada." }],
    }));

  const counts = (st: RequestStatus) => list.filter((r) => r.status === st).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Solicitações"
        description="Peça o que precisar para a equipe. Cada pedido ganha um número de ticket e fica registrado aqui."
        actions={
          <button type="button" className={primaryButtonClass} onClick={() => setCreating(true)}>
            {isGraphic ? "Nova peça gráfica" : "Nova solicitação"}
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-1 self-start rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
        {(
          [
            ["requests", "Solicitações digitais"],
            ["graphics", "Peças gráficas"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSection(key);
              setFilter("all");
              setOpenId(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${section === key ? "bg-white/[0.08] text-[#F5F2EE]" : "text-[#A3A5B2] hover:text-[#F5F2EE]"}`}
          >
            {label} <span className="text-xs text-[#8B8D9A]">({s[key].length})</span>
          </button>
        ))}
      </div>
      {isGraphic && (
        <p className={`${rowClass} px-4 py-3 text-sm text-[#A3A5B2]`}>
          A impressão é feita por gráfica parceira e não está inclusa no plano. A equipe cria a arte, manda a cotação aqui e você aprova ou não antes de imprimir.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["all", "waiting", "progress", "done"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "border-[#FF2B00]/60 bg-[#FF2B00]/10 text-[#F5F2EE]" : "border-white/10 text-[#A3A5B2] hover:text-[#F5F2EE]"}`}>
            {f === "all" ? `Todas (${list.length})` : `${REQ_STATUS[f].label} (${counts(f)})`}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {shown.length === 0 && <p className="text-sm text-[#8B8D9A]">Nenhum pedido aqui.</p>}
        {shown.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className={`${rowClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:border-white/20`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 rounded-lg bg-white/[0.05] px-2 py-1 font-mono text-xs text-[#D6D3CF]">#{r.ticket}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-[#8B8D9A]">
                  Aberta em {dmy(r.createdAt)}
                  {r.deadline && ` · entrega até ${dmy(r.deadline)}`}
                  {(r.links.length > 0 || r.attachments.length > 0) && ` · ${r.links.length + r.attachments.length} anexo(s)/link(s)`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isGraphic && <QuoteBadge r={r} />}
              <Badge tone={REQ_STATUS[r.status].tone}>{REQ_STATUS[r.status].label}</Badge>
            </div>
          </button>
        ))}
      </div>

      {current && (
        <Modal
          title={
            <>
              <span className="mr-2 font-mono text-sm text-[#8B8D9A]">#{current.ticket}</span>
              {current.title}
            </>
          }
          onClose={() => setOpenId(null)}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={REQ_STATUS[current.status].tone}>{REQ_STATUS[current.status].label}</Badge>
              {isGraphic && <QuoteBadge r={current} />}
            </div>
            {current.description && <p className="whitespace-pre-line text-sm text-[#D6D3CF]">{current.description}</p>}
            <div className={`${rowClass} flex flex-col gap-1 p-3 text-sm`}>
              <div className="flex justify-between gap-3">
                <span className="text-[#8B8D9A]">Aberta em</span>
                <span>{dmy(current.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8B8D9A]">Data limite de entrega</span>
                <span>{current.deadline ? dmy(current.deadline) : "Sem prazo"}</span>
              </div>
            </div>
            {current.links.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-[#8B8D9A]">Links de referência</p>
                <ul className="flex flex-col gap-1">
                  {current.links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all text-sm text-[#84CAFF] hover:underline">
                        <Link2 size={14} className="shrink-0" /> {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {current.attachments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-[#8B8D9A]">Arquivos anexados</p>
                <ul className="flex flex-col gap-1">
                  {current.attachments.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-sm text-[#D6D3CF]">
                      <Paperclip size={14} className="shrink-0 text-[#FF8A3D]" /> {f.name} <span className="text-xs text-[#8B8D9A]">({f.size})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isGraphic && current.quote?.status === "pending" && (
              <div className="flex flex-col gap-2 rounded-2xl border border-[#FDB022]/30 bg-[#FDB022]/[0.06] p-4">
                <p className="text-sm font-semibold text-[#FEC84B]">Cotação da impressão: {brl(current.quote.amount)}</p>
                <p className="text-sm text-[#D6D3CF]">{current.quote.note}</p>
                <p className="text-xs text-[#8B8D9A]">Valor cobrado à parte, fora da mensalidade.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primaryButtonClass} onClick={() => decideQuote(current, true)}>
                    <Check size={16} /> Aprovar impressão
                  </button>
                  <button type="button" className={ghostButtonClass} onClick={() => decideQuote(current, false)}>
                    Recusar
                  </button>
                </div>
              </div>
            )}
            <div className="border-t border-white/[0.06] pt-3">
              <p className="mb-2 text-xs font-medium text-[#8B8D9A]">Histórico</p>
              <ul className="flex flex-col gap-2">
                {current.updates.map((u, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-[#F5F2EE]">{u.author}</span> <span className="text-xs text-[#8B8D9A]">{dmy(u.at)}</span>
                    <p className="text-[#A3A5B2]">{u.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}

      {creating && (
        <Modal title={isGraphic ? "Nova peça gráfica" : "Nova solicitação"} onClose={() => setCreating(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <label className="flex flex-col gap-1 text-sm text-[#D6D3CF]">
              Título
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isGraphic ? "Ex.: Cartão de visita (500 un.)" : "Ex.: Post sobre o feriado"} className={`${inputClass} h-11`} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#D6D3CF]">
              O que você precisa
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva com detalhes: texto, cores, tamanho, quantidade…" className={`${inputClass} py-2`} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#D6D3CF]">
              Data limite de entrega
              <input type="date" value={deadline} min={todayIso()} onChange={(e) => setDeadline(e.target.value)} className={`${inputClass} h-11`} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#D6D3CF]">
              Links de referência (um por linha)
              <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="https://…" className={`${inputClass} py-2`} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[#D6D3CF]">
              Anexar arquivos
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: fileSize(f.size) })))}
                className="text-sm text-[#A3A5B2] file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#F5F2EE]"
              />
            </label>
            {files.length > 0 && <p className="text-xs text-[#8B8D9A]">{files.map((f) => f.name).join(", ")}</p>}
            <p className="text-xs text-[#8B8D9A]">Demonstração: os arquivos não são enviados, só o nome fica registrado.</p>
            <button type="submit" className={primaryButtonClass} disabled={!title.trim()}>
              Enviar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Arquivos ---------------- */
function Files({ s }: { s: DemoState }) {
  const [toast, setToast] = useState(false);
  const icon = { image: ImageIcon, video: Film, pdf: FileText };
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Arquivos" description="Tudo o que a equipe compartilhou com você, pronto pra baixar." />
      <div className="flex flex-col gap-2">
        {s.files.map((f) => {
          const Icon = icon[f.kind];
          return (
            <div key={f.id} className={`${rowClass} flex items-center gap-3 px-4 py-3`}>
              <Icon size={18} className="text-[#FF8A3D]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-[#8B8D9A]">
                  {f.size} · {dmy(f.date)}
                </p>
              </div>
              <button type="button" className={ghostButtonClass} onClick={() => setToast(true)}>
                <Download size={15} /> Baixar
              </button>
            </div>
          );
        })}
      </div>
      {toast && (
        <Modal title="Demonstração" onClose={() => setToast(false)}>
          <p className="text-sm text-[#D6D3CF]">No painel de verdade, o arquivo é baixado aqui. Nesta demonstração os arquivos são de exemplo.</p>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Tráfego pago ---------------- */
function Traffic({ s }: { s: DemoState }) {
  const [open, setOpen] = useState<DemoCampaign | null>(null);
  const [period, setPeriod] = useState<TrafficPeriod>("month");
  const t = DEMO_TRAFFIC[period];
  const pct = (v: number) => `${v > 0 ? "+" : ""}${v}% ${t.compare}`;
  const order = { Ativa: 0, Pausada: 1, Encerrada: 2 } as const;
  const list = [...s.campaigns].sort((a, b) => order[a.status] - order[b.status] || b.start.localeCompare(a.start));
  const tone = { Ativa: "green", Pausada: "yellow", Encerrada: "gray" } as const;
  const bars = useMemo(() => leadsByMonth(), []);
  const max = Math.max(...bars.map((b) => b.value));
  const growth = (bars[bars.length - 1]!.value / bars[0]!.value).toFixed(1).replace(".", ",");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tráfego pago" description="Resultado dos seus anúncios no Facebook e no Instagram, atualizado todo dia." />
      <section className={`${panelClass} flex flex-col gap-5 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Resumo de tráfego</h2>
          <div className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1">
            {(["month", "week", "today"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${period === p ? "bg-white/[0.08] text-[#F5F2EE]" : "text-[#A3A5B2] hover:text-[#F5F2EE]"}`}>
                {DEMO_TRAFFIC[p].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Alcance (pessoas)" value={num(t.reach)} hint={pct(t.delta.reach)} />
          <Stat label="Visualizações" value={num(t.impressions)} />
          <Stat label="Cliques no anúncio" value={num(t.clicks)} hint={`CTR ${((t.clicks / t.impressions) * 100).toFixed(2).replace(".", ",")}%`} />
          <Stat label="Leads gerados" value={num(t.leads)} hint={pct(t.delta.leads)} />
          <Stat label="Custo por lead" value={brl(t.spend / t.leads)} hint={pct(t.delta.cpl)} />
          <Stat label="Valor investido" value={brl(t.spend)} />
          <Stat label="Campanhas ativas" value={String(s.campaigns.filter((c) => c.status === "Ativa").length)} />
          <Stat label="Frequência média" value={t.frequency.toFixed(1).replace(".", ",")} />
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-[#D6D3CF]">Leads por mês (últimos 12 meses)</p>
            <p className="text-xs text-[#6CE9A6]">
              {bars[bars.length - 1]!.value} leads no mês passado · {growth}x o de 12 meses atrás
            </p>
          </div>
          <div className="flex h-44 items-end gap-1.5">
            {bars.map((b, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-semibold tabular-nums text-[#F5F2EE]">{b.value}</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#FF2B00] to-[#FF8A3D]" style={{ height: `calc((100% - 20px) * ${b.value / max})` }} title={`${b.label}: ${b.value} leads`} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 border-t border-white/[0.06] pt-1.5">
            {bars.map((b, i) => (
              <span key={i} className="flex-1 text-center text-[10px] capitalize text-[#8B8D9A]">
                {b.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin size={15} className="text-[#12B76A]" /> Onde estamos anunciando
          </h3>
          <p className="mb-3 text-xs text-[#8B8D9A]">Americana (raio de 4 km), Santa Bárbara d&apos;Oeste (2 km) e Nova Odessa (2,8 km). Os bairros em vermelho ficam fora dos anúncios, para investir só onde está o seu público.</p>
          <DemoMap />
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge tone="green">Área dos anúncios</Badge>
            <Badge tone="red">Bairros excluídos: Jardim São Paulo, Distrito Industrial, Jardim Europa</Badge>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Campanhas ({s.campaigns.length})</h2>
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-[#8B8D9A]">
              <tr>
                <th className="px-4 py-3 font-medium">Campanha</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Investido</th>
                <th className="px-3 py-3 text-right font-medium">Alcance</th>
                <th className="px-3 py-3 text-right font-medium">Leads</th>
                <th className="px-4 py-3 text-right font-medium">Custo/lead</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer border-t border-white/[0.05] hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3">
                    <Badge tone={tone[c.status]}>{c.status}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right">{brl(c.spend)}</td>
                  <td className="px-3 py-3 text-right">{num(c.reach)}</td>
                  <td className="px-3 py-3 text-right">{c.leads ? num(c.leads) : "—"}</td>
                  <td className="px-4 py-3 text-right">{c.leads ? brl(c.spend / c.leads) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={tone[open.status]}>{open.status}</Badge>
              <span className="text-xs text-[#8B8D9A]">
                {dmy(open.start)} {open.end ? `a ${dmy(open.end)}` : "até hoje"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Investido" value={brl(open.spend)} />
              <Stat label="Alcance" value={num(open.reach)} />
              <Stat label="Visualizações" value={num(open.impressions)} />
              <Stat label="Cliques" value={num(open.clicks)} />
              <Stat label="Leads" value={open.leads ? num(open.leads) : "—"} />
              <Stat label="Custo por lead" value={open.leads ? brl(open.spend / open.leads) : "—"} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Financeiro ---------------- */
/** QR Code de verdade (leva ao site da Zenite) com a marca no centro; correção de erro alta para aguentar o selo. */
function PixQr() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    toDataURL(SITE_URL, { errorCorrectionLevel: "H", margin: 1, width: 480, color: { dark: "#0A0B10", light: "#FFFFFF" } })
      .then((url) => alive && setSrc(url))
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="relative mx-auto h-52 w-52 rounded-2xl bg-white p-2.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR Code para pagamento via Pix" className="h-full w-full" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-black/10" />
      )}
      <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#FF2B00] text-[15px] font-bold text-white">Z</span>
    </div>
  );
}

const PROVIDER = { name: "Zenite Marketing (demonstração)", doc: "00.000.000/0001-00", city: "Americana/SP" };
const CUSTOMER = { name: "Cliente Demonstração", doc: "11.111.111/0001-11" };

/** Abre o recibo ou a NFS-e numa janela própria para imprimir ou salvar em PDF. */
function printDocument(inv: DemoInvoice, kind: "receipt" | "nf") {
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) return;
  const paid = inv.paidAt ? dmy(inv.paidAt) : "";
  const title = kind === "receipt" ? `Recibo ${inv.receipt}` : `NFS-e nº ${inv.nf}`;
  const body =
    kind === "receipt"
      ? `<h1>Recibo</h1><p class="n">${inv.receipt}</p>
         <p>Recebemos de <b>${CUSTOMER.name}</b> (CNPJ ${CUSTOMER.doc}) a importância de <b>${brl(inv.amount)}</b>, referente à mensalidade de <b>${inv.month}</b> (gestão de tráfego e redes sociais).</p>
         <table><tr><td>Forma de pagamento</td><td>${inv.method ?? ""}</td></tr><tr><td>Data do pagamento</td><td>${paid}</td></tr><tr><td>Vencimento</td><td>${dmy(inv.due)}</td></tr></table>
         <p class="sign">${PROVIDER.name}<br/>CNPJ ${PROVIDER.doc} · ${PROVIDER.city}</p>`
      : `<h1>Nota Fiscal de Serviço Eletrônica</h1><p class="n">NFS-e nº ${inv.nf} · emitida em ${paid}</p>
         <h2>Prestador</h2><p>${PROVIDER.name}<br/>CNPJ ${PROVIDER.doc} · ${PROVIDER.city}</p>
         <h2>Tomador</h2><p>${CUSTOMER.name}<br/>CNPJ ${CUSTOMER.doc}</p>
         <h2>Serviço</h2><table><tr><td>Gestão de tráfego pago e redes sociais · ${inv.month}</td><td>${brl(inv.amount)}</td></tr><tr><td>ISS (2%)</td><td>${brl(inv.amount * 0.02)}</td></tr><tr><td><b>Valor total</b></td><td><b>${brl(inv.amount)}</b></td></tr></table>
         <p class="n">Código de verificação: ${inv.nf.slice(-4)}-DEMO-${inv.id.toUpperCase()}</p>`;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;color:#111;max-width:640px;margin:40px auto;padding:0 24px;line-height:1.5}
    h1{font-size:22px;margin:0}h2{font-size:14px;margin:20px 0 4px;text-transform:uppercase;color:#555}
    .n{color:#666;font-size:13px}.tag{display:inline-block;background:#FF2B00;color:#fff;font-size:11px;padding:2px 8px;border-radius:99px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;margin:12px 0}td{border-bottom:1px solid #ddd;padding:8px 0}td:last-child{text-align:right}
    .sign{margin-top:48px;border-top:1px solid #111;padding-top:8px;width:320px}
  </style></head><body><span class="tag">DOCUMENTO DE DEMONSTRAÇÃO · SEM VALOR FISCAL</span>${body}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

function ReceiptModal({ inv, onClose }: { inv: DemoInvoice; onClose: () => void }) {
  return (
    <Modal title={`Recibo e nota fiscal · ${inv.month}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className={`${rowClass} flex flex-col gap-1 p-3 text-sm`}>
          <div className="flex justify-between gap-3"><span className="text-[#8B8D9A]">Recibo</span><span className="font-mono">{inv.receipt}</span></div>
          <div className="flex justify-between gap-3"><span className="text-[#8B8D9A]">NFS-e</span><span className="font-mono">nº {inv.nf}</span></div>
          <div className="flex justify-between gap-3"><span className="text-[#8B8D9A]">Valor</span><span>{brl(inv.amount)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-[#8B8D9A]">Pago em</span><span>{inv.paidAt ? dmy(inv.paidAt) : "—"} ({inv.method})</span></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={ghostButtonClass} onClick={() => printDocument(inv, "receipt")}>
            <Download size={15} /> Baixar recibo
          </button>
          <button type="button" className={ghostButtonClass} onClick={() => printDocument(inv, "nf")}>
            <FileText size={15} /> Baixar NF
          </button>
        </div>
        <p className="text-xs text-[#8B8D9A]">Abre o documento para imprimir ou salvar em PDF. Demonstração: sem valor fiscal.</p>
      </div>
    </Modal>
  );
}

function Finance({ s, update }: { s: DemoState; update: Update }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [method, setMethod] = useState<"pix" | "boleto" | "card" | null>(null);
  const [copied, setCopied] = useState(false);
  const open = openId ? s.invoices.find((i) => i.id === openId) : null;
  const receipt = receiptId ? s.invoices.find((i) => i.id === receiptId) : null;
  const pay = (inv: DemoInvoice, how: string) => {
    update((st) => ({ ...st, invoices: st.invoices.map((i) => (i.id === inv.id ? { ...i, status: "paid", paidAt: todayIso(), method: how } : i)) }));
    setMethod(null);
  };
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const pixCode = "00020126580014BR.GOV.BCB.PIX0136demonstracao-zenite-hub5204000053039865406" + "1890.005802BR5920ZENITE DEMONSTRACAO6009AMERICANA62070503***6304ABCD";
  const boleto = "34191.79001 01043.510047 91020.150008 1 " + "9988000189000";
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Financeiro" description="Suas faturas da Zenite. Pague a mensalidade por Pix, boleto ou cartão, e baixe recibo e nota fiscal das pagas." />
      <div className="flex flex-col gap-2">
        {s.invoices
          .slice()
          .reverse()
          .map((inv) => (
            <div key={inv.id} className={`${rowClass} flex flex-wrap items-center gap-3 px-4 py-3`}>
              <button type="button" onClick={() => setOpenId(inv.id)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <Receipt size={18} className="text-[#FF8A3D]" />
                  <div>
                    <p className="text-sm font-medium capitalize">Mensalidade de {inv.month}</p>
                    <p className="text-xs text-[#8B8D9A]">{inv.status === "paid" && inv.paidAt ? `Paga em ${dmy(inv.paidAt)} · ${inv.method}` : `Vence em ${dmy(inv.due)}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{brl(inv.amount)}</span>
                  {inv.status === "paid" ? (
                    <Badge tone="green">
                      <Check size={12} /> Paga
                    </Badge>
                  ) : (
                    <Badge tone="orange">Em aberto</Badge>
                  )}
                </div>
              </button>
              {inv.status === "paid" ? (
                <button type="button" className={`${ghostButtonClass} h-9`} onClick={() => setReceiptId(inv.id)}>
                  <FileText size={15} /> Recibo / NF
                </button>
              ) : (
                <button type="button" className={`${primaryButtonClass} h-9`} onClick={() => setOpenId(inv.id)}>
                  Pagar
                </button>
              )}
            </div>
          ))}
      </div>
      {open && (
        <Modal
          title={`Fatura de ${open.month}`}
          onClose={() => {
            setOpenId(null);
            setMethod(null);
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Valor" value={brl(open.amount)} />
              <Stat label="Vencimento" value={dmy(open.due)} />
            </div>
            <div className={`${rowClass} flex flex-col gap-1 p-3 text-sm`}>
              <div className="flex justify-between"><span className="text-[#8B8D9A]">Fechamento</span><span>{dmy(open.closing)}</span></div>
              <div className="flex justify-between"><span className="text-[#8B8D9A]">Gestão de tráfego e redes sociais</span><span>{brl(open.amount)}</span></div>
              {open.status === "paid" && <div className="flex justify-between"><span className="text-[#8B8D9A]">Pago em</span><span>{dmy(open.paidAt ?? todayIso())} ({open.method})</span></div>}
            </div>
            {open.status === "paid" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone="green"><CheckCircle2 size={12} /> Fatura paga. Obrigado!</Badge>
                <button type="button" className={ghostButtonClass} onClick={() => { setReceiptId(open.id); setOpenId(null); }}>
                  <FileText size={15} /> Recibo / NF
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">Pagar com</p>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className={`${ghostButtonClass} ${method === "pix" ? "border-[#FF2B00]" : ""}`} onClick={() => setMethod("pix")}><QrCode size={16} /> Pix</button>
                  <button type="button" className={`${ghostButtonClass} ${method === "boleto" ? "border-[#FF2B00]" : ""}`} onClick={() => setMethod("boleto")}><Receipt size={16} /> Boleto</button>
                  <button type="button" className={`${ghostButtonClass} ${method === "card" ? "border-[#FF2B00]" : ""}`} onClick={() => setMethod("card")}><CreditCard size={16} /> Cartão</button>
                </div>
                {method === "pix" && (
                  <div className="flex flex-col gap-3">
                    <PixQr />
                    <p className="text-center text-sm font-medium text-[#F5F2EE]">{brl(open.amount)} · Zenite Marketing</p>
                    <p className="text-center text-xs text-[#8B8D9A]">Aponte a câmera do app do banco ou copie o código. Na demonstração, o QR abre o site da Zenite.</p>
                    <button type="button" className={ghostButtonClass} onClick={() => void copy(pixCode)}>{copied ? "Copiado" : "Copiar código Pix"}</button>
                    <button type="button" className={primaryButtonClass} onClick={() => pay(open, "Pix")}>Simular pagamento confirmado</button>
                  </div>
                )}
                {method === "boleto" && (
                  <div className="flex flex-col gap-3">
                    <p className="break-all rounded-xl bg-white/[0.04] p-3 font-mono text-xs">{boleto}</p>
                    <div className="flex gap-2">
                      <button type="button" className={ghostButtonClass} onClick={() => void copy(boleto)}>{copied ? "Copiado" : "Copiar linha digitável"}</button>
                      <button type="button" className={ghostButtonClass}><Download size={15} /> Baixar PDF</button>
                    </div>
                    <button type="button" className={primaryButtonClass} onClick={() => pay(open, "Boleto")}>Simular pagamento confirmado</button>
                  </div>
                )}
                {method === "card" && (
                  <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); pay(open, "Cartão de crédito"); }}>
                    <input required placeholder="Número do cartão" inputMode="numeric" className={`${inputClass} h-11`} />
                    <input required placeholder="Nome impresso no cartão" className={`${inputClass} h-11`} />
                    <div className="grid grid-cols-2 gap-2">
                      <input required placeholder="Validade (MM/AA)" className={`${inputClass} h-11`} />
                      <input required placeholder="CVV" inputMode="numeric" className={`${inputClass} h-11`} />
                    </div>
                    <select className={`${inputClass} h-11`} defaultValue="1">
                      <option value="1">1x de {brl(open.amount)}</option>
                      <option value="2">2x de {brl(open.amount / 2)}</option>
                      <option value="3">3x de {brl(open.amount / 3)}</option>
                    </select>
                    <p className="text-xs text-[#8B8D9A]">Demonstração: nenhum dado de cartão é enviado ou guardado.</p>
                    <button type="submit" className={primaryButtonClass}>Pagar {brl(open.amount)}</button>
                  </form>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
      {receipt && <ReceiptModal inv={receipt} onClose={() => setReceiptId(null)} />}
    </div>
  );
}

/* ---------------- App ---------------- */
export function DemoPortalApp({ art }: { art?: DemoRealArtSet }) {
  const pathname = usePathname();
  const { state, update, reset } = useDemoState(art);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!state) return <div className="h-64 animate-pulse rounded-[22px] bg-white/[0.03]" />;

  const view = pathname.replace(/^\/portal\/?/, "").split("/")[0] ?? "";
  const content = (() => {
    switch (view) {
      case "calendario":
        return <Calendar s={state} update={update} />;
      case "solicitacoes":
        return <Requests key="requests" s={state} update={update} initial="requests" />;
      case "grafica":
        return <Requests key="graphics" s={state} update={update} initial="graphics" />;
      case "arquivos":
        return <Files s={state} />;
      case "trafego":
        return <Traffic s={state} />;
      case "financeiro":
        return <Finance s={state} update={update} />;
      default:
        // Aprovações agora ficam no Início.
        return <Home s={state} update={update} />;
    }
  })();

  return (
    <>
      {content}
      <button type="button" onClick={() => setConfirmReset(true)} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#13141C]/90 px-4 py-2.5 text-sm font-medium text-[#E7E4E0] shadow-lg backdrop-blur hover:border-white/20">
        <RotateCcw size={15} /> Resetar painel
      </button>
      {confirmReset && (
        <Modal title="Resetar painel de demonstração" onClose={() => setConfirmReset(false)}>
          <p className="text-sm text-[#D6D3CF]">Tudo volta ao estado original: artes pendentes, datas do calendário, solicitações e faturas. Nada disso existe no CRM.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={ghostButtonClass} onClick={() => setConfirmReset(false)}>Cancelar</button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                reset();
                setConfirmReset(false);
              }}
            >
              Resetar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
