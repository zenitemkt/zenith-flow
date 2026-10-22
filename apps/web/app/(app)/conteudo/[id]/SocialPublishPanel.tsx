"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, Facebook, Instagram, Send, Zap } from "lucide-react";
import type { SocialPlatform, SocialPostFormat, SocialPostStatus } from "@zenite-mkt/db";
import { PlatformTimeFields } from "@/components/PlatformTimeFields";

export interface PanelConnection {
  platform: SocialPlatform;
  name: string;
  status: "ACTIVE" | "ERROR";
}

export interface PanelPost {
  id: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  format: SocialPostFormat;
  publishAtISO: string;
  permalink: string | null;
  lastError: string | null;
  autoScheduled: boolean;
}

const ICON = { INSTAGRAM: Instagram, FACEBOOK: Facebook, GOOGLE_BUSINESS: Send } as const;
const LABEL: Record<SocialPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE_BUSINESS: "Google" };
const FORMAT_LABEL: Record<SocialPostFormat, string> = { FEED: "Feed", REEL: "Reels", STORY: "Story" };
const STATUS: Record<SocialPostStatus, { label: string; cls: string }> = {
  SCHEDULED: { label: "Agendado", cls: "bg-[#EEF4FF] text-[#2859B8]" },
  PUBLISHING: { label: "Publicando...", cls: "bg-[#FEF3C7] text-[#92600A]" },
  PROCESSING: { label: "Processando vídeo", cls: "bg-[#FEF3C7] text-[#92600A]" },
  PUBLISHED: { label: "Publicado", cls: "bg-[#DCFCE7] text-[#166534]" },
  FAILED: { label: "Falhou", cls: "bg-[#FEE4E2] text-[#B42318]" },
  CANCELED: { label: "Cancelado", cls: "bg-[#F2F4F7] text-[#667085]" },
};

const CAPTION_MAX = 2200;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** Hoje em São Paulo, AAAA-MM-DD. */
function todaySP() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export function SocialPublishPanel({
  contentId,
  clientId,
  connections,
  posts,
  mediaCount,
  hasVideo,
  defaultCaption,
  defaultDate,
  defaultTime,
  defaultFormat,
  defaultPlatform,
}: {
  contentId: string;
  clientId: string;
  connections: PanelConnection[];
  posts: PanelPost[];
  mediaCount: number;
  hasVideo: boolean;
  defaultCaption: string;
  defaultDate: string | null;
  defaultTime: string;
  defaultFormat: SocialPostFormat;
  defaultPlatform: SocialPlatform | null;
}) {
  const router = useRouter();
  const active = connections.filter((c) => c.status === "ACTIVE");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(() => {
    const preferred = active.find((c) => c.platform === defaultPlatform);
    return preferred ? [preferred.platform] : active.map((c) => c.platform);
  });
  const [format, setFormat] = useState<SocialPostFormat>(defaultFormat);
  const [caption, setCaption] = useState(defaultCaption);
  const [date, setDate] = useState(defaultDate && defaultDate >= todaySP() ? defaultDate : todaySP());
  const [time, setTime] = useState(defaultTime);
  /** Horário próprio de cada rede (mesma data); a rede que não está aqui usa `time`. */
  const [overrides, setOverrides] = useState<Partial<Record<SocialPlatform, string>>>({});
  const timeOf = (p: SocialPlatform) => overrides[p] ?? time;
  const [busy, setBusy] = useState<"schedule" | "now" | string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function toggle(p: SocialPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function submit(now: boolean) {
    if (busy) return;
    setMessage(null);
    const instants = Object.fromEntries(platforms.map((p) => [p, new Date(`${date}T${timeOf(p)}:00-03:00`)])) as Record<string, Date>;
    if (!now && Object.values(instants).some((d) => Number.isNaN(d.getTime()))) {
      setMessage({ kind: "error", text: "Escolha a hora de cada rede." });
      return;
    }
    const when = platforms.map((p) => `${LABEL[p]} às ${timeOf(p)}`).join(" e ");
    if (!now && !window.confirm(`Agendar para ${date.split("-").reverse().join("/")} — ${when}?`)) return;
    if (now && !window.confirm("Publicar agora nas redes marcadas? Isso vai ao ar imediatamente.")) return;
    setBusy(now ? "now" : "schedule");
    // publishAt = o mais cedo (padrão); cada rede segue o próprio horário em publishAtByPlatform.
    const earliest = Math.min(...Object.values(instants).map((d) => d.getTime()));
    const publishAt = new Date(now || !Number.isFinite(earliest) ? Date.now() : earliest).toISOString();
    const publishAtByPlatform = now ? undefined : Object.fromEntries(Object.entries(instants).map(([p, d]) => [p, d.toISOString()]));
    const res = await fetch(`/api/content/${contentId}/social-posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms, format, caption, publishAt, publishAtByPlatform, now }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: "error", text: body?.error ?? "Não foi possível agendar." });
      return;
    }
    if (now) {
      const outcomes = Object.values((body?.outcomes ?? {}) as Record<string, string | null>);
      const failed = outcomes.filter((o) => o === "failed").length;
      setMessage(
        failed
          ? { kind: "error", text: "Uma ou mais redes falharam — veja o erro abaixo." }
          : { kind: "ok", text: outcomes.includes("processing") ? "Enviado! O vídeo está processando e sai em alguns minutos." : "Publicado!" },
      );
    } else {
      setMessage({ kind: "ok", text: "Agendado! Vai ao ar sozinho na data e hora escolhidas." });
    }
    router.refresh();
  }

  async function act(postId: string, action: "cancel" | "retry") {
    if (busy) return;
    if (action === "cancel" && !window.confirm("Cancelar este agendamento?")) return;
    setBusy(postId);
    const res = await fetch(`/api/social-posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) setMessage({ kind: "error", text: body?.error ?? "Não foi possível concluir." });
    router.refresh();
  }

  const history = posts.length > 0 && (
    <ul className="flex flex-col gap-2">
      {posts.map((post) => {
        const Icon = ICON[post.platform];
        const status = STATUS[post.status];
        return (
          <li key={post.id} className="flex flex-col gap-1 rounded-lg border border-[#EEF0F3] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Icon size={15} className="text-[#475467]" aria-hidden />
              <span className="font-medium text-[#101828]">
                {LABEL[post.platform]} · {FORMAT_LABEL[post.format]}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
              {post.autoScheduled && <span className="text-[11px] text-[#98A2B3]">automático</span>}
              <span className="ml-auto text-xs text-[#667085]">{fmt(post.publishAtISO)}</span>
            </div>
            {post.lastError && post.status !== "PUBLISHED" && <p className="text-xs text-[#B42318]">{post.lastError}</p>}
            <div className="flex flex-wrap gap-3 text-xs">
              {post.permalink && (
                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#101828] hover:underline">
                  Ver post <ExternalLink size={12} aria-hidden />
                </a>
              )}
              {(post.status === "SCHEDULED" || post.status === "FAILED") && (
                <button type="button" disabled={busy !== null} onClick={() => void act(post.id, "cancel")} className="font-medium text-[#667085] hover:text-[#B42318] disabled:opacity-60">
                  Cancelar
                </button>
              )}
              {post.status === "FAILED" && (
                <button type="button" disabled={busy !== null} onClick={() => void act(post.id, "retry")} className="font-semibold text-[#FF2B00] hover:underline disabled:opacity-60">
                  {busy === post.id ? "Reenviando..." : "Tentar de novo agora"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (connections.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[#667085]">
          Este cliente ainda não tem Instagram ou Facebook conectado.{" "}
          <Link href={`/clientes/${clientId}#redes`} className="font-semibold text-[#FF2B00] hover:underline">
            Conectar redes
          </Link>
        </p>
        {history}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mediaCount === 0 && (
        <p className="rounded-lg bg-[#FEF3C7] px-3 py-2 text-xs text-[#92600A]">
          A última versão não tem arquivos da arte. Para publicar no Instagram, envie os arquivos em &quot;+ Nova versão&quot;.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {connections.map((c) => {
          const Icon = ICON[c.platform];
          const on = platforms.includes(c.platform);
          return (
            <button
              key={c.platform}
              type="button"
              disabled={c.status !== "ACTIVE"}
              onClick={() => toggle(c.platform)}
              aria-pressed={on}
              title={c.status !== "ACTIVE" ? "Conexão com erro — reconecte no perfil do cliente" : c.name}
              className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
                on ? "border-[#101828] bg-[#101828] text-white" : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"
              }`}
            >
              <Icon size={15} aria-hidden />
              {LABEL[c.platform]}
              <span className={`max-w-[120px] truncate text-xs ${on ? "text-white/70" : "text-[#98A2B3]"}`}>{c.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#667085]">Formato</span>
        <div className="flex gap-1.5">
          {(["FEED", "REEL", "STORY"] as SocialPostFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              disabled={(f === "REEL" && !hasVideo) || (f === "STORY" && mediaCount !== 1)}
              className={`h-9 flex-1 rounded-lg text-sm font-medium disabled:opacity-40 ${
                format === f ? "bg-[#F2F4F7] font-semibold text-[#101828] ring-1 ring-[#101828]" : "border border-[#E4E7EC] text-[#475467]"
              }`}
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
        {mediaCount > 1 && format === "FEED" && <p className="text-xs text-[#667085]">{mediaCount} arquivos → sai como carrossel.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="social-caption" className="flex justify-between text-xs font-medium text-[#667085]">
          Legenda
          <span className={caption.length > CAPTION_MAX ? "text-[#B42318]" : ""}>
            {caption.length}/{CAPTION_MAX}
          </span>
        </label>
        <textarea
          id="social-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          disabled={format === "STORY"}
          placeholder={format === "STORY" ? "Story não tem legenda." : "Legenda com hashtags..."}
          className="resize-y rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] disabled:bg-[#F9FAFB]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-[#667085]">
          Data
          <input
            type="date"
            value={date}
            min={todaySP()}
            onChange={(e) => {
              setDate(e.target.value);
              setOverrides({});
            }}
            className="h-10 rounded-lg border border-[#D0D5DD] px-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
          />
        </label>
        {platforms.length === 0 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-[#667085]">
            Hora (Brasília)
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 rounded-lg border border-[#D0D5DD] px-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]" />
          </label>
        ) : (
          <PlatformTimeFields
            platforms={platforms}
            date={date}
            times={Object.fromEntries(platforms.map((p) => [p, timeOf(p)]))}
            onChange={(p, value) => setOverrides((prev) => ({ ...prev, [p]: value }))}
            labelClass="text-xs font-medium text-[#667085]"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null || platforms.length === 0}
          onClick={() => void submit(false)}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          <CalendarClock size={16} aria-hidden />
          {busy === "schedule" ? "Agendando..." : "Agendar"}
        </button>
        <button
          type="button"
          disabled={busy !== null || platforms.length === 0}
          onClick={() => void submit(true)}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
        >
          <Zap size={16} aria-hidden />
          {busy === "now" ? "Publicando..." : "Publicar agora"}
        </button>
      </div>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === "ok" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"}`}>
          {message.text}
        </p>
      )}

      {history && (
        <div className="flex flex-col gap-2 border-t border-[#EEF0F3] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Publicações</p>
          {history}
        </div>
      )}
    </div>
  );
}
