"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Facebook, Film, ImagePlus, Instagram, X, Zap } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import type { SocialPlatform, SocialPostFormat } from "@zenite-mkt/db";
import { CONTENT_MEDIA_MAX_FILES, isVideoType, validateContentMediaFile } from "@/lib/content-media";
import { uploadContentMedia, type UploadedMedia } from "@/lib/content-media-upload";
import { formatBytes } from "@/lib/media";
import { quickPostMediaError } from "@/lib/social-quick-post";
import { PlatformTimeFields } from "@/components/PlatformTimeFields";

/** Cliente com Instagram/Facebook conectado — só esses aparecem na publicação direta. */
export interface QuickPostClient {
  id: string;
  name: string;
  defaultPublishTime: string;
  connections: { platform: SocialPlatform; name: string; active: boolean }[];
}

const ICON = { INSTAGRAM: Instagram, FACEBOOK: Facebook, GOOGLE_BUSINESS: CalendarClock } as const;
const LABEL: Record<SocialPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE_BUSINESS: "Google" };
const FORMAT_LABEL: Record<SocialPostFormat, string> = { FEED: "Feed", REEL: "Reels", STORY: "Story" };
const CAPTION_MAX = 2200;

/** Hoje em São Paulo, AAAA-MM-DD. */
export function todaySP(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Próxima hora cheia em São Paulo ("14:00"), pra quando o dia escolhido é hoje. */
function nextRoundHourSP(): string {
  const hour = (new Date(Date.now() - 3 * 3600_000).getUTCHours() + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00`;
}

function defaultTimeFor(date: string, client: QuickPostClient | undefined): string {
  const preferred = client?.defaultPublishTime ?? "10:00";
  if (date !== todaySP()) return preferred;
  const nowTime = new Date(Date.now() - 3 * 3600_000).toISOString().slice(11, 16);
  return preferred > nowTime ? preferred : nextRoundHourSP();
}

export function QuickPostModal({
  open,
  onClose,
  initialDate,
  initialClientId,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  initialClientId?: string;
  clients: QuickPostClient[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [format, setFormat] = useState<SocialPostFormat>("FEED");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("10:00");
  /** Horário próprio de cada rede (mesma data); a rede que não está aqui usa `time`. */
  const [overrides, setOverrides] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [busy, setBusy] = useState<"schedule" | "now" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId);

  function selectClient(id: string, forDate: string) {
    const next = clients.find((c) => c.id === id);
    setClientId(id);
    setPlatforms(next ? next.connections.filter((c) => c.active).map((c) => c.platform) : []);
    setTime(defaultTimeFor(forDate, next));
    setOverrides({});
  }

  // Cada abertura começa limpa, no dia clicado.
  useEffect(() => {
    if (!open) return;
    const start = initialDate < todaySP() ? todaySP() : initialDate;
    setDate(start);
    setFormat("FEED");
    setFiles([]);
    setTitle("");
    setCaption("");
    setError(null);
    setDone(null);
    setProgress(null);
    const preset = clients.find((c) => c.id === initialClientId) ?? (clients.length === 1 ? clients[0] : undefined);
    selectClient(preset?.id ?? "", start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate]);

  const timeOf = (p: SocialPlatform) => overrides[p] ?? time;

  function close() {
    if (busy) return;
    onClose();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(list)) {
      const invalid = validateContentMediaFile(file, { source: true });
      if (invalid) {
        setError(invalid);
        continue;
      }
      if (next.length >= CONTENT_MEDIA_MAX_FILES) {
        setError(`No máximo ${CONTENT_MEDIA_MAX_FILES} arquivos (limite do carrossel).`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
  }

  function togglePlatform(p: SocialPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function submit(now: boolean) {
    if (busy) return;
    setError(null);
    if (!client) return setError("Escolha o cliente.");
    const mediaError = quickPostMediaError({ platforms, format, files });
    if (mediaError) return setError(mediaError);
    if (caption.length > CAPTION_MAX) return setError(`A legenda passa de ${CAPTION_MAX} caracteres.`);
    const byPlatform = Object.fromEntries(platforms.map((p) => [p, new Date(`${date}T${timeOf(p)}:00-03:00`)])) as Partial<Record<SocialPlatform, Date>>;
    const instants = platforms.map((p) => byPlatform[p]!);
    if (!now && instants.some((d) => Number.isNaN(d.getTime()))) return setError("Escolha a hora de cada rede.");
    if (!now && instants.some((d) => d.getTime() < Date.now())) return setError("Esse horário já passou. Escolha outro ou use Publicar agora.");
    // publishAt = o mais cedo; é ele que dá a data da peça e valida a criação.
    const publishAt = now ? new Date() : new Date(Math.min(...instants.map((d) => d.getTime())));
    const networks = platforms.map((p) => LABEL[p]).join(" e ");
    const question = now
      ? `Publicar agora no ${networks} de ${client.name}? Vai ao ar imediatamente.`
      : `Agendar para ${date.split("-").reverse().join("/")} — ${platforms.map((p) => `${LABEL[p]} às ${timeOf(p)}`).join(" e ")} (${client.name})?`;
    if (!window.confirm(question)) return;

    setBusy(now ? "now" : "schedule");
    const payload = {
      platforms,
      format,
      caption: format === "STORY" ? "" : caption,
      publishAt: publishAt.toISOString(),
      publishAtByPlatform: now ? undefined : Object.fromEntries(platforms.map((p) => [p, byPlatform[p]!.toISOString()])),
    };
    let contentId: string | null = null;
    let scheduled = false;
    try {
      setProgress("Preparando...");
      const created = await fetch("/api/social/quick-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, clientId: client.id, title }),
      });
      const createdBody = await created.json().catch(() => null);
      if (!created.ok) throw new Error(createdBody?.error ?? "Não foi possível criar a publicação.");
      contentId = createdBody.id as string;

      if (files.length > 0) {
        const media: UploadedMedia[] = [];
        for (const [index, file] of files.entries()) {
          setProgress(`Enviando arte ${index + 1} de ${files.length}...`);
          media.push(await uploadContentMedia(contentId, file));
        }
        const version = await fetch(`/api/content/${contentId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media, notes: "Enviada pelo Calendário" }),
        });
        if (!version.ok) {
          const body = await version.json().catch(() => null);
          throw new Error(body?.error ?? "Não foi possível salvar a arte.");
        }
      }

      setProgress(now ? "Publicando..." : "Agendando...");
      const res = await fetch(`/api/social/quick-post/${contentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, now }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível agendar.");
      scheduled = true;

      if (now) {
        const outcomes = Object.values((body?.outcomes ?? {}) as Record<string, string | null>);
        if (outcomes.includes("failed")) {
          setError("Uma ou mais redes falharam. Abra o cartão da publicação para ver o motivo e tentar de novo.");
        } else {
          setDone(outcomes.includes("processing") ? "Enviado! O vídeo está processando e sai em alguns minutos." : "Publicado!");
        }
      } else {
        setDone("Agendado! Vai ao ar sozinho na data e hora escolhidas.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio.");
      // Não deixa cartão pela metade se a arte ou o agendamento não foram concluídos.
      if (contentId && !scheduled) await fetch(`/api/social/quick-post/${contentId}`, { method: "DELETE" }).catch(() => null);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const hasVideo = files.some((f) => isVideoType(f.type));
  const isToday = date === todaySP();

  return (
    <Modal open={open} onClose={close} size="lg" title="Nova publicação" description="Agende ou publique direto, sem precisar de um cartão antes.">
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-[#DCFCE7] px-3 py-3 text-sm font-medium text-[#166534]">{done}</p>
          {error && <p className="text-sm text-[#B42318]">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: "#FF2B00" }}>
              Fechar
            </button>
          </div>
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-[#667085]">
          Nenhum cliente tem Instagram ou Facebook conectado ainda. Conecte no perfil do cliente, seção{" "}
          <Link href="/clientes/carteira" className="font-semibold text-[#FF2B00] hover:underline">
            Redes conectadas
          </Link>
          .
        </p>
      ) : (
        <fieldset disabled={busy !== null} className="flex min-w-0 flex-col gap-4 border-0 p-0">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
            Cliente
            <select
              value={clientId}
              onChange={(e) => selectClient(e.target.value, date)}
              className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
            >
              <option value="">Escolha o cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {client && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#344054]">Redes</span>
              <div className="flex flex-wrap gap-2">
                {client.connections.map((c) => {
                  const Icon = ICON[c.platform];
                  const on = platforms.includes(c.platform);
                  return (
                    <button
                      key={c.platform}
                      type="button"
                      disabled={!c.active}
                      onClick={() => togglePlatform(c.platform)}
                      aria-pressed={on}
                      title={c.active ? c.name : "Conexão com erro — reconecte no perfil do cliente"}
                      className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
                        on ? "border-[#101828] bg-[#101828] text-white" : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <Icon size={15} aria-hidden />
                      {LABEL[c.platform]}
                      <span className={`max-w-[140px] truncate text-xs ${on ? "text-white/70" : "text-[#98A2B3]"}`}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#344054]">Formato</span>
            <div className="flex gap-1.5">
              {(["FEED", "REEL", "STORY"] as SocialPostFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  aria-pressed={format === f}
                  className={`h-9 flex-1 rounded-lg text-sm font-medium ${
                    format === f ? "bg-[#F2F4F7] font-semibold text-[#101828] ring-1 ring-[#101828]" : "border border-[#E4E7EC] text-[#475467]"
                  }`}
                >
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#344054]">Arte</span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#D0D5DD] px-4 py-5 text-center hover:border-[#FF2B00] hover:bg-[#FFF9F7]">
              <ImagePlus size={20} className="text-[#667085]" aria-hidden />
              <span className="text-sm font-semibold text-[#101828]">Escolher imagem ou vídeo</span>
              <span className="text-xs text-[#667085]">
                {format === "REEL" ? "Um vídeo MP4 ou MOV" : format === "STORY" ? "Um arquivo" : "Vários arquivos viram carrossel (até 10)"}
              </span>
              <input
                type="file"
                multiple={format === "FEED"}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ol className="flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-[#EEF0F3] px-2.5 py-2 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F2F4F7] text-xs font-semibold text-[#475467]">
                      {index + 1}
                    </span>
                    {isVideoType(file.type) && <Film size={14} className="shrink-0 text-[#667085]" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-[#344054]">{file.name}</span>
                    <span className="shrink-0 text-xs text-[#98A2B3]">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      aria-label={`Remover ${file.name}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {hasVideo && files.length > 1 && <p className="text-xs text-[#667085]">Carrossel com vídeo só sai no Instagram.</p>}
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
            Título no cartão (opcional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Se ficar vazio, usa o começo da legenda"
              className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quick-caption" className="flex justify-between text-sm font-medium text-[#344054]">
              Legenda
              <span className={`text-xs font-normal ${caption.length > CAPTION_MAX ? "text-[#B42318]" : "text-[#98A2B3]"}`}>
                {caption.length}/{CAPTION_MAX}
              </span>
            </label>
            <textarea
              id="quick-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              disabled={format === "STORY"}
              placeholder={format === "STORY" ? "Story não tem legenda." : "Legenda com hashtags..."}
              className="resize-y rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] disabled:bg-[#F9FAFB]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
            <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
              Data
              <input
                type="date"
                value={date}
                min={todaySP()}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime(defaultTimeFor(e.target.value, client));
                  setOverrides({});
                }}
                className="h-10 rounded-lg border border-[#D0D5DD] px-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
              />
            </label>
            {platforms.length === 0 ? (
              <label className="flex flex-col gap-1 text-sm font-medium text-[#344054]">
                Hora (Brasília)
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 rounded-lg border border-[#D0D5DD] px-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
                />
              </label>
            ) : (
              <PlatformTimeFields
                platforms={platforms}
                date={date}
                times={Object.fromEntries(platforms.map((p) => [p, timeOf(p)]))}
                onChange={(p, value) => setOverrides((prev) => ({ ...prev, [p]: value }))}
                labelClass="text-sm font-medium text-[#344054]"
              />
            )}
          </div>

          {progress && <p className="text-sm text-[#667085]">{progress}</p>}
          {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm text-[#B42318]">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {isToday && (
              <button
                type="button"
                disabled={!client || platforms.length === 0}
                onClick={() => void submit(true)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
              >
                <Zap size={16} aria-hidden />
                {busy === "now" ? "Publicando..." : "Publicar agora"}
              </button>
            )}
            <button
              type="button"
              disabled={!client || platforms.length === 0}
              onClick={() => void submit(false)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              <CalendarClock size={16} aria-hidden />
              {busy === "schedule" ? "Agendando..." : platforms.length === 0 ? "Agendar" : `Agendar para ${[...new Set(platforms.map(timeOf))].join(" / ")}`}
            </button>
          </div>
        </fieldset>
      )}
    </Modal>
  );
}
