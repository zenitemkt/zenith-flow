"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, CheckCircle2, Clock, CreditCard, Download, FileText, Film, ImageIcon, MapPin, QrCode, Receipt, RotateCcw, X } from "lucide-react";
import { PageHeader, ghostButtonClass, inputClass, panelClass, primaryButtonClass, rowClass } from "../_components/ui";
import { buildDemoState, type DemoArt, type DemoCampaign, type DemoInvoice, type DemoPost, type DemoRequest, type DemoState } from "./demo-data";

const DemoMap = dynamic(() => import("./DemoMap").then((m) => m.DemoMap), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-2xl bg-white/[0.04]" /> });

const STORAGE_KEY = "zf-portal-demo-v1";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) => v.toLocaleString("pt-BR");
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Estado da demonstração: só no navegador; "Resetar painel" volta ao original. */
function useDemoState() {
  const [state, setState] = useState<DemoState | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(JSON.parse(saved) as DemoState);
        return;
      }
    } catch {
      /* sem armazenamento: usa o original */
    }
    setState(buildDemoState());
  }, []);
  const update = (fn: (s: DemoState) => DemoState) =>
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
    setState(buildDemoState());
  };
  return { state, update, reset };
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
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

function Badge({ tone, children }: { tone: "green" | "orange" | "blue" | "gray" | "yellow"; children: ReactNode }) {
  const cls = { green: "bg-[#12B76A]/15 text-[#6CE9A6]", orange: "bg-[#FF2B00]/15 text-[#FF8A3D]", blue: "bg-[#2E90FA]/15 text-[#84CAFF]", gray: "bg-white/[0.06] text-[#A3A5B2]", yellow: "bg-[#FDB022]/15 text-[#FEC84B]" }[tone];
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

/* ---------------- Início ---------------- */
function Home({ s }: { s: DemoState }) {
  const pending = s.arts.filter((a) => a.status === "pending");
  const upcoming = [...s.arts.filter((a) => a.status === "approved").map((a) => ({ id: a.id, title: a.title, date: a.publishAt, channel: a.channel })), ...s.posts.filter((p) => !p.done).map((p) => ({ id: p.id, title: p.title, date: p.date, channel: p.channel }))].sort((a, b) => a.date.localeCompare(b.date));
  const open = s.requests.filter((r) => r.status !== "done");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Olá! Aqui está tudo do seu marketing" description="Acompanhe aprovações, publicações, anúncios e pagamentos num lugar só." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/portal/aprovacoes" className={`${rowClass} p-4 hover:border-white/20`}>
          <p className="text-xs text-[#8B8D9A]">Esperando sua aprovação</p>
          <p className="mt-1 text-3xl font-semibold text-[#FF8A3D]">{pending.length}</p>
        </Link>
        <Link href="/portal/calendario" className={`${rowClass} p-4 hover:border-white/20`}>
          <p className="text-xs text-[#8B8D9A]">Próximas publicações</p>
          <p className="mt-1 text-3xl font-semibold text-[#F5F2EE]">{upcoming.length}</p>
        </Link>
        <Link href="/portal/solicitacoes" className={`${rowClass} p-4 hover:border-white/20`}>
          <p className="text-xs text-[#8B8D9A]">Solicitações em andamento</p>
          <p className="mt-1 text-3xl font-semibold text-[#F5F2EE]">{open.length}</p>
        </Link>
      </div>
      <section className={`${panelClass} p-5`}>
        <h2 className="mb-3 text-base font-semibold">Próximas publicações</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[#8B8D9A]">Nada agendado. Aprove as artes para elas entrarem aqui.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((u) => (
              <li key={u.id} className={`${rowClass} flex items-center justify-between gap-3 px-4 py-3`}>
                <div>
                  <p className="text-sm font-medium">{u.title}</p>
                  <p className="text-xs text-[#8B8D9A]">{u.channel}</p>
                </div>
                <Badge tone="blue">
                  <Clock size={12} /> {dmy(u.date)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------- Aprovações ---------------- */
function Approvals({ s, update }: { s: DemoState; update: (fn: (s: DemoState) => DemoState) => void }) {
  const [open, setOpen] = useState<DemoArt | null>(null);
  const [note, setNote] = useState("");
  const decide = (art: DemoArt, status: "approved" | "changes") => {
    update((st) => ({ ...st, arts: st.arts.map((a) => (a.id === art.id ? { ...a, status, note: status === "changes" ? note : undefined } : a)) }));
    setOpen(null);
    setNote("");
  };
  const label = { pending: <Badge tone="orange">Aguardando você</Badge>, approved: <Badge tone="green"><Check size={12} /> Aprovada</Badge>, changes: <Badge tone="yellow">Ajustes pedidos</Badge> };
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Aprovações" description="Veja cada arte, aprove ou peça ajustes. A equipe é avisada na hora." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {s.arts.map((art) => (
          <button key={art.id} type="button" onClick={() => setOpen(art)} className={`${panelClass} overflow-hidden text-left hover:border-white/20`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.image} alt="" className="aspect-[4/5] w-full object-cover" />
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{art.title}</p>
              </div>
              <p className="text-xs text-[#8B8D9A]">
                {art.channel} · {art.format} · publicação {dmy(art.publishAt)}
              </p>
              {label[art.status]}
            </div>
          </button>
        ))}
      </div>
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <div className="grid gap-5 md:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.image} alt="" className="w-full rounded-2xl" />
            <div className="flex flex-col gap-3">
              <p className="text-xs text-[#8B8D9A]">
                {open.channel} · {open.format} · publicação prevista {dmy(open.publishAt)}
              </p>
              <p className="whitespace-pre-line rounded-2xl bg-white/[0.03] p-3 text-sm text-[#D6D3CF]">{open.caption}</p>
              {open.status === "pending" ? (
                <>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Comentário ou ajuste (opcional)" className={`${inputClass} py-2`} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={primaryButtonClass} onClick={() => decide(open, "approved")}>
                      <Check size={16} /> Aprovar
                    </button>
                    <button type="button" className={ghostButtonClass} onClick={() => decide(open, "changes")}>
                      Pedir ajustes
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  {label[open.status]}
                  {open.note && <p className="text-sm text-[#A3A5B2]">Seu comentário: {open.note}</p>}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Calendário ---------------- */
function Calendar({ s, update }: { s: DemoState; update: (fn: (s: DemoState) => DemoState) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [open, setOpen] = useState<{ kind: "post" | "art"; id: string } | null>(null);
  const items = [
    ...s.posts.map((p) => ({ kind: "post" as const, id: p.id, title: p.title, date: p.date, done: p.done, image: p.image, channel: p.channel, format: p.format, caption: p.caption })),
    ...s.arts.filter((a) => a.status === "approved").map((a) => ({ kind: "art" as const, id: a.id, title: a.title, date: a.publishAt, done: false, image: a.image, channel: a.channel, format: a.format, caption: a.caption })),
  ];
  const first = cursor.getDay();
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1);
  const iso = (d: number) => new Date(cursor.getFullYear(), cursor.getMonth(), d).toISOString().slice(0, 10);
  const current = open ? items.find((i) => i.kind === open.kind && i.id === open.id) : null;
  const move = (date: string) => {
    if (!open || !date) return;
    update((st) =>
      open.kind === "post"
        ? { ...st, posts: st.posts.map((p) => (p.id === open.id ? { ...p, date, done: date < todayIso() ? p.done : false } : p)) }
        : { ...st, arts: st.arts.map((a) => (a.id === open.id ? { ...a, publishAt: date } : a)) },
    );
  };
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Calendário"
        description="O que já foi publicado e o que vem por aí. Clique num post para ver ou mudar a data."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" className={ghostButtonClass} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              ←
            </button>
            <span className="min-w-[140px] text-center text-sm capitalize">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
            <button type="button" className={ghostButtonClass} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              →
            </button>
          </div>
        }
      />
      <div className={`${panelClass} overflow-x-auto p-3`}>
        <div className="grid min-w-[640px] grid-cols-7 gap-1 text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="px-2 py-1 text-[#8B8D9A]">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const valid = d >= 1 && d <= days;
            const dayItems = valid ? items.filter((it) => it.date === iso(d)) : [];
            const isToday = valid && iso(d) === todayIso();
            return (
              <div key={i} className={`min-h-[92px] rounded-xl p-1.5 ${valid ? "bg-white/[0.025]" : ""} ${isToday ? "ring-1 ring-[#FF2B00]/60" : ""}`}>
                {valid && <p className="mb-1 text-[11px] text-[#8B8D9A]">{d}</p>}
                {dayItems.map((it) => (
                  <button key={it.kind + it.id} type="button" onClick={() => setOpen({ kind: it.kind, id: it.id })} className={`mb-1 flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-[11px] ${it.done ? "bg-[#12B76A]/15 text-[#6CE9A6]" : "bg-[#2E90FA]/15 text-[#84CAFF]"}`}>
                    {it.done ? <CheckCircle2 size={12} className="shrink-0" /> : <Clock size={12} className="shrink-0" />}
                    <span className="truncate">{it.title}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-[#8B8D9A]">
        <Badge tone="green"><CheckCircle2 size={12} /> Publicado</Badge>
        <Badge tone="blue"><Clock size={12} /> Agendado</Badge>
      </div>
      {current && (
        <Modal title={current.title} onClose={() => setOpen(null)} wide>
          <div className="grid gap-5 md:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.image} alt="" className="w-full rounded-2xl" />
            <div className="flex flex-col gap-3">
              {current.done ? <Badge tone="green"><CheckCircle2 size={12} /> Publicado</Badge> : <Badge tone="blue"><Clock size={12} /> Agendado</Badge>}
              <p className="text-xs text-[#8B8D9A]">
                {current.channel} · {current.format}
              </p>
              <p className="whitespace-pre-line rounded-2xl bg-white/[0.03] p-3 text-sm text-[#D6D3CF]">{current.caption}</p>
              {!current.done && (
                <label className="flex flex-col gap-1 text-sm text-[#D6D3CF]">
                  Mudar a data de publicação
                  <input type="date" value={current.date} onChange={(e) => move(e.target.value)} className={`${inputClass} h-10`} />
                </label>
              )}
              {current.done && <p className="text-sm text-[#A3A5B2]">Publicado em {dmy(current.date)}.</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Solicitações / Peças gráficas ---------------- */
function Requests({ s, update, kind }: { s: DemoState; update: (fn: (s: DemoState) => DemoState) => void; kind: "requests" | "graphics" }) {
  const list = s[kind];
  const [open, setOpen] = useState<DemoRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const status = { open: <Badge tone="orange">Aberta</Badge>, progress: <Badge tone="blue">Em andamento</Badge>, done: <Badge tone="green">Concluída</Badge> };
  const create = () => {
    if (!title.trim()) return;
    const item: DemoRequest = { id: `n${Date.now()}`, title: title.trim(), description: description.trim(), status: "open", createdAt: todayIso(), updates: [{ at: todayIso(), author: "Você", text: "Pedido aberto." }] };
    update((st) => ({ ...st, [kind]: [item, ...st[kind]] }));
    setCreating(false);
    setTitle("");
    setDescription("");
  };
  const isGraphic = kind === "graphics";
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={isGraphic ? "Peças gráficas" : "Solicitações"}
        description={isGraphic ? "Peça orçamento de materiais impressos: cartões, banners, fachadas." : "Fale com a equipe: pedidos, ajustes e ideias, tudo registrado."}
        actions={
          <button type="button" className={primaryButtonClass} onClick={() => setCreating(true)}>
            {isGraphic ? "Pedir orçamento" : "Nova solicitação"}
          </button>
        }
      />
      <div className="flex flex-col gap-2">
        {list.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpen(r)} className={`${rowClass} flex items-center justify-between gap-3 px-4 py-3 text-left hover:border-white/20`}>
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-[#8B8D9A]">Aberta em {dmy(r.createdAt)}</p>
            </div>
            {status[r.status]}
          </button>
        ))}
      </div>
      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-3">
            {status[open.status]}
            {open.description && <p className="text-sm text-[#D6D3CF]">{open.description}</p>}
            <ul className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
              {open.updates.map((u, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-[#F5F2EE]">{u.author}</span> <span className="text-xs text-[#8B8D9A]">{dmy(u.at)}</span>
                  <p className="text-[#A3A5B2]">{u.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
      {creating && (
        <Modal title={isGraphic ? "Pedir orçamento" : "Nova solicitação"} onClose={() => setCreating(false)}>
          <div className="flex flex-col gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className={`${inputClass} h-11`} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Detalhes" className={`${inputClass} py-2`} />
            <button type="button" className={primaryButtonClass} onClick={create}>
              Enviar
            </button>
          </div>
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
  const t = useMemo(() => {
    const sum = (k: keyof Pick<DemoCampaign, "spend" | "reach" | "impressions" | "clicks" | "leads">) => s.campaigns.reduce((a, c) => a + c[k], 0);
    const spend = sum("spend");
    const leads = sum("leads");
    return { spend, leads, reach: sum("reach"), impressions: sum("impressions"), clicks: sum("clicks"), cpl: leads ? spend / leads : 0 };
  }, [s.campaigns]);
  const order = { Ativa: 0, Pausada: 1, Encerrada: 2 } as const;
  const list = [...s.campaigns].sort((a, b) => order[a.status] - order[b.status] || b.start.localeCompare(a.start));
  const tone = { Ativa: "green", Pausada: "yellow", Encerrada: "gray" } as const;
  const bars = [62, 74, 58, 81, 95, 88, 102, 97, 110, 121, 115, 132];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tráfego pago" description="Resultado dos seus anúncios no Facebook e no Instagram, atualizado todo dia." />
      <section className={`${panelClass} flex flex-col gap-5 p-5`}>
        <h2 className="text-base font-semibold">Resumo de tráfego</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Alcance (pessoas)" value={num(t.reach)} hint="+18% no último mês" />
          <Stat label="Visualizações" value={num(t.impressions)} />
          <Stat label="Cliques no anúncio" value={num(t.clicks)} hint={`CTR ${((t.clicks / t.impressions) * 100).toFixed(2).replace(".", ",")}%`} />
          <Stat label="Leads gerados" value={num(t.leads)} hint="+24% no último mês" />
          <Stat label="Custo por lead" value={brl(t.cpl)} hint="-12% no último mês" />
          <Stat label="Valor total investido" value={brl(t.spend)} />
          <Stat label="Campanhas ativas" value={String(s.campaigns.filter((c) => c.status === "Ativa").length)} />
          <Stat label="Frequência média" value="1,9" />
        </div>
        <div>
          <p className="mb-2 text-xs text-[#8B8D9A]">Leads por mês (últimos 12 meses)</p>
          <div className="flex h-28 items-end gap-1.5">
            {bars.map((b, i) => (
              <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-[#FF2B00] to-[#FF8A3D]" style={{ height: `${(b / 132) * 100}%` }} title={`${b} leads`} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin size={15} className="text-[#FF2B00]" /> Onde estamos anunciando
          </h3>
          <p className="mb-3 text-xs text-[#8B8D9A]">Americana e região, num raio de 9 km. As áreas em amarelo ficam fora dos anúncios, para investir só onde está o seu público.</p>
          <DemoMap />
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge tone="orange">Área dos anúncios</Badge>
            <Badge tone="yellow">Bairros excluídos: Jardim São Paulo, Distrito Industrial, Praia Azul</Badge>
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
function FakeQr() {
  const cells = useMemo(() => Array.from({ length: 29 * 29 }, (_, i) => ((i * 7919) % 13) < 6), []);
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x > 21 && y < 7) || (x < 7 && y > 21);
  return (
    <svg viewBox="0 0 29 29" className="mx-auto h-48 w-48 rounded-lg bg-white p-2" shapeRendering="crispEdges">
      {cells.map((on, i) => {
        const x = i % 29;
        const y = Math.floor(i / 29);
        if (finder(x, y)) {
          const lx = x > 21 ? x - 22 : x;
          const ly = y > 21 ? y - 22 : y;
          const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
          return ring ? <rect key={i} x={x} y={y} width="1" height="1" fill="#000" /> : null;
        }
        return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#000" /> : null;
      })}
    </svg>
  );
}

function Finance({ s, update }: { s: DemoState; update: (fn: (s: DemoState) => DemoState) => void }) {
  const [open, setOpen] = useState<DemoInvoice | null>(null);
  const [method, setMethod] = useState<"pix" | "boleto" | "card" | null>(null);
  const [copied, setCopied] = useState(false);
  const pay = (inv: DemoInvoice, how: string) => {
    update((st) => ({ ...st, invoices: st.invoices.map((i) => (i.id === inv.id ? { ...i, status: "paid", paidAt: todayIso(), method: how } : i)) }));
    setOpen({ ...inv, status: "paid", paidAt: todayIso(), method: how });
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
      <PageHeader title="Financeiro" description="Suas faturas da Zenite. Pague a mensalidade por Pix, boleto ou cartão, sem sair daqui." />
      <div className="flex flex-col gap-2">
        {s.invoices
          .slice()
          .reverse()
          .map((inv) => (
            <button key={inv.id} type="button" onClick={() => setOpen(inv)} className={`${rowClass} flex items-center justify-between gap-3 px-4 py-3 text-left hover:border-white/20`}>
              <div className="flex items-center gap-3">
                <Receipt size={18} className="text-[#FF8A3D]" />
                <div>
                  <p className="text-sm font-medium capitalize">Mensalidade de {inv.month}</p>
                  <p className="text-xs text-[#8B8D9A]">Vence em {dmy(inv.due)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{brl(inv.amount)}</span>
                {inv.status === "paid" ? <Badge tone="green"><Check size={12} /> Paga</Badge> : <Badge tone="orange">Em aberto</Badge>}
              </div>
            </button>
          ))}
      </div>
      {open && (
        <Modal
          title={`Fatura de ${open.month}`}
          onClose={() => {
            setOpen(null);
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
              <Badge tone="green"><CheckCircle2 size={12} /> Fatura paga. Obrigado!</Badge>
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
                    <FakeQr />
                    <p className="text-center text-xs text-[#8B8D9A]">Aponte a câmera do app do banco ou copie o código.</p>
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
    </div>
  );
}

/* ---------------- App ---------------- */
export function DemoPortalApp() {
  const pathname = usePathname();
  const { state, update, reset } = useDemoState();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!state) return <div className="h-64 animate-pulse rounded-[22px] bg-white/[0.03]" />;

  const view = pathname.replace(/^\/portal\/?/, "").split("/")[0] ?? "";
  const content = (() => {
    switch (view) {
      case "aprovacoes":
        return <Approvals s={state} update={update} />;
      case "calendario":
        return <Calendar s={state} update={update} />;
      case "solicitacoes":
        return <Requests s={state} update={update} kind="requests" />;
      case "grafica":
        return <Requests s={state} update={update} kind="graphics" />;
      case "arquivos":
        return <Files s={state} />;
      case "trafego":
        return <Traffic s={state} />;
      case "financeiro":
        return <Finance s={state} update={update} />;
      default:
        return <Home s={state} />;
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
