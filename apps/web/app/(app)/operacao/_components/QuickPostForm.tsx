"use client";

import { confirmDialog } from "@/lib/dialogs";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Facebook, Film, ImagePlus, Instagram, MessageCircle, X, Zap } from "lucide-react";
import type { SocialPlatform, SocialPostFormat } from "@zenite-mkt/db";
import { CONTENT_MEDIA_MAX_FILES, isVideoType, validateContentMediaFile } from "@/lib/content-media";
import { uploadContentMedia, type UploadedMedia } from "@/lib/content-media-upload";
import { formatBytes } from "@/lib/media";
import { quickPostMediaError } from "@/lib/social-quick-post";
import { PlatformTimeFields } from "@/components/PlatformTimeFields";
import { PostPreview, type PreviewProfile } from "@/components/PostPreview";

/** Cliente com Instagram/Facebook conectado — só esses aparecem na publicação direta. */
export interface QuickPostClient {
  id: string;
  name: string;
  defaultPublishTime: string;
  hasAvatar: boolean;
  connections: { platform: SocialPlatform; name: string; username?: string | null; pictureUrl?: string | null; active: boolean }[];
}

const ICON = { INSTAGRAM: Instagram, FACEBOOK: Facebook, GOOGLE_BUSINESS: CalendarClock } as const;
const LABEL: Record<SocialPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE_BUSINESS: "Google" };
const FORMAT_LABEL: Record<SocialPostFormat, string> = { FEED: "Feed", REEL: "Reels", STORY: "Story" };
const CAPTION_MAX = 2200;

const INPUT = "h-10 w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";
const FIELD_LABEL = "text-sm font-medium text-[#344054]";

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

function activePlatforms(client: QuickPostClient | undefined): SocialPlatform[] {
  return client ? client.connections.filter((c) => c.active).map((c) => c.platform) : [];
}

/**
 * Formulário da publicação direta (cliente → redes → formato → arte → legenda).
 * - `mode="schedule"` (Calendário): data/hora por rede, Agendar e, no dia de hoje, Publicar agora.
 * - `mode="instant"` (Operação > Publicação): sem data nem hora, só Publicar agora.
 * Monta limpo a cada vez (o modal desmonta ao fechar; a página troca a `key`).
 */
export function QuickPostForm({
  mode,
  clients,
  initialDate,
  initialClientId,
  source,
  onClose,
  onReset,
  onBusyChange,
}: {
  mode: "schedule" | "instant";
  clients: QuickPostClient[];
  initialDate?: string;
  initialClientId?: string;
  /** Vai na nota da versão ("Enviada pelo Calendário"). */
  source: string;
  /** Modal: botão Fechar depois de concluir. */
  onClose?: () => void;
  /** Página: botão "Fazer outra publicação". */
  onReset?: () => void;
  /** Avisa quando começa/termina um envio (o modal não deixa fechar no meio). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const instant = mode === "instant";
  const startDate = !initialDate || initialDate < todaySP() ? todaySP() : initialDate;
  const preset = clients.find((c) => c.id === initialClientId) ?? (clients.length === 1 ? clients[0] : undefined);

  const [clientId, setClientId] = useState(preset?.id ?? "");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(() => activePlatforms(preset));
  const [format, setFormat] = useState<SocialPostFormat>("FEED");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(startDate);
  const [time, setTime] = useState(() => defaultTimeFor(startDate, preset));
  /** Horário próprio de cada rede (mesma data); a rede que não está aqui usa `time`. */
  const [overrides, setOverrides] = useState<Partial<Record<SocialPlatform, string>>>({});
  // Mini-chat do post: palavra-chave nos comentários → resposta pública + direct automático.
  const [miniChat, setMiniChat] = useState({ enabled: false, keyword: "", responseText: "", publicReplies: "", buttons: [{ text: "", url: "" }] });
  const miniChatAvailable = platforms.includes("INSTAGRAM") && format !== "STORY";
  const [busy, setBusy] = useState<"schedule" | "now" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; contentId: string } | null>(null);

  const client = clients.find((c) => c.id === clientId);

  useEffect(() => {
    onBusyChange?.(busy !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  function selectClient(id: string) {
    const next = clients.find((c) => c.id === id);
    setClientId(id);
    setPlatforms(activePlatforms(next));
    setTime(defaultTimeFor(date, next));
    setOverrides({});
  }

  const timeOf = (p: SocialPlatform) => overrides[p] ?? time;

  // Pré-visualização: a arte escolhida vira URL local (liberada ao trocar os arquivos).
  const previewMedia = useMemo(() => files.map((f) => ({ url: URL.createObjectURL(f), isVideo: isVideoType(f.type) })), [files]);
  useEffect(() => () => previewMedia.forEach((m) => URL.revokeObjectURL(m.url)), [previewMedia]);
  const previewProfiles = useMemo(() => {
    const out: Partial<Record<SocialPlatform, PreviewProfile>> = {};
    if (!client) return out;
    for (const c of client.connections) {
      out[c.platform] = {
        name: c.name || client.name,
        username: c.username,
        avatarUrl: client.hasAvatar ? `/api/clients/${client.id}/image/avatar` : c.pictureUrl,
      };
    }
    return out;
  }, [client]);

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
    if (format !== "STORY" && caption.length > CAPTION_MAX) return setError(`A legenda passa de ${CAPTION_MAX} caracteres.`);
    if (miniChatAvailable && miniChat.enabled) {
      if (!miniChat.keyword.trim()) return setError("Mini-chat: informe a palavra-chave.");
      if (!miniChat.responseText.trim()) return setError("Mini-chat: escreva a mensagem que vai no direct.");
      const badButton = miniChat.buttons.some((b) => (b.text.trim() || b.url.trim()) && (!b.text.trim() || !/^https?:\/\//i.test(b.url.trim())));
      if (badButton) return setError("Mini-chat: cada botão precisa de texto e de um link começando com https://.");
    }
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
    if (!await confirmDialog(question)) return;

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
        body: JSON.stringify({ ...payload, clientId: client.id, title: format === "STORY" ? "" : title }),
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
          body: JSON.stringify({ media, notes: `Enviada ${source}` }),
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
        body: JSON.stringify({
          ...payload,
          now,
          miniChat: miniChatAvailable && miniChat.enabled
            ? {
                enabled: true,
                keyword: miniChat.keyword,
                responseText: miniChat.responseText,
                publicReplyTexts: miniChat.publicReplies.split("\n"),
                buttons: miniChat.buttons.filter((b) => b.text.trim() || b.url.trim()),
              }
            : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível agendar.");
      scheduled = true;

      if (now) {
        const outcomes = Object.values((body?.outcomes ?? {}) as Record<string, string | null>);
        if (outcomes.includes("failed")) {
          setError("Uma ou mais redes falharam. Abra o cartão da publicação para ver o motivo e tentar de novo.");
        }
        setDone({
          contentId,
          text: outcomes.includes("failed")
            ? "Enviado, mas com falha em alguma rede."
            : outcomes.includes("processing") || outcomes.includes("queued")
              ? "Enviado! A mídia está processando e sai em alguns minutos."
              : "Publicado!",
        });
      } else {
        setDone({ contentId, text: "Agendado! Vai ao ar sozinho na data e hora escolhidas." });
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

  if (done) {
    const failed = done.text.includes("falha");
    return (
      <div className="flex flex-col gap-4">
        <p className={`rounded-lg px-3 py-3 text-sm font-medium ${failed ? "bg-[#FEF3C7] text-[#92600A]" : "bg-[#DCFCE7] text-[#166534]"}`}>{done.text}</p>
        {error && <p className="text-sm text-[#B42318]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/conteudo/${done.contentId}`}
            className="flex h-10 items-center rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB]"
          >
            Abrir cartão da publicação
          </Link>
          {onReset && (
            <button type="button" onClick={onReset} className="h-10 rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: "#FF2B00" }}>
              Fazer outra publicação
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm font-semibold text-white" style={{ backgroundColor: "#FF2B00" }}>
              Fechar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <p className="text-sm text-[#667085]">
        Nenhum cliente tem Instagram ou Facebook conectado ainda. Conecte no perfil do cliente, seção{" "}
        <Link href="/clientes/carteira" className="font-semibold text-[#FF2B00] hover:underline">
          Redes conectadas
        </Link>
        .
      </p>
    );
  }

  const hasVideo = files.some((f) => isVideoType(f.type));
  const canNow = instant || date === todaySP();
  const disabled = !client || platforms.length === 0;

  return (
    <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <fieldset disabled={busy !== null} className="flex min-w-0 flex-col gap-4 border-0 p-0">
        <label className={`flex flex-col gap-1.5 ${FIELD_LABEL}`}>
          Cliente
          <select value={clientId} onChange={(e) => selectClient(e.target.value)} className={INPUT}>
            <option value="">Escolha o cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {client && client.connections.length === 0 && (
          <p className="rounded-lg bg-[#FEF3C7] px-3 py-2 text-sm text-[#92600A]">
            {client.name} ainda não tem Instagram nem Facebook conectado.{" "}
            <Link href={`/clientes/${client.id}#redes`} className="font-semibold underline">
              Conectar redes
            </Link>
          </p>
        )}

        {client && client.connections.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Redes</span>
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
                    className={`flex h-10 min-w-0 max-w-full items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
                      on ? "border-[#101828] bg-[#101828] text-white" : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <Icon size={15} className="shrink-0" aria-hidden />
                    <span className="shrink-0">{LABEL[c.platform]}</span>
                    <span className={`min-w-0 max-w-[140px] truncate text-xs ${on ? "text-white/70" : "text-[#98A2B3]"}`}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Formato</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(["FEED", "REEL", "STORY"] as SocialPostFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={`h-9 rounded-lg text-sm font-medium ${
                  format === f ? "bg-[#F2F4F7] font-semibold text-[#101828] ring-1 ring-[#101828]" : "border border-[#E4E7EC] text-[#475467]"
                }`}
              >
                {FORMAT_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>Arte</span>
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
                <li key={`${file.name}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-[#EEF0F3] px-2.5 py-2 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F2F4F7] text-xs font-semibold text-[#475467]">{index + 1}</span>
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

        <label className={`flex flex-col gap-1.5 ${FIELD_LABEL}`}>
          Título no cartão (opcional)
          <input
            value={format === "STORY" ? "" : title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={format === "STORY"}
            placeholder={format === "STORY" ? "Story não tem título nem legenda." : "Se ficar vazio, usa o começo da legenda"}
            className={`${INPUT} disabled:bg-[#F9FAFB]`}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="quick-caption" className={`flex justify-between ${FIELD_LABEL}`}>
            Legenda
            <span className={`text-xs font-normal ${caption.length > CAPTION_MAX ? "text-[#B42318]" : "text-[#98A2B3]"}`}>
              {caption.length}/{CAPTION_MAX}
            </span>
          </label>
          <textarea
            id="quick-caption"
            value={format === "STORY" ? "" : caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={5}
            disabled={format === "STORY"}
            placeholder={format === "STORY" ? "Story não tem legenda." : "Legenda com hashtags..."}
            className="w-full min-w-0 resize-y rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] disabled:bg-[#F9FAFB]"
          />
        </div>

        {miniChatAvailable && (
          <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={miniChat.enabled} onChange={(e) => setMiniChat((m) => ({ ...m, enabled: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#FF2B00]" />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-[#101828]">
                  <MessageCircle size={15} aria-hidden className="text-[#FF2B00]" /> Mini-chat: palavra-chave nos comentários
                </span>
                <span className="block text-xs text-[#667085]">Quem comentar a palavra neste post recebe uma resposta no comentário e uma mensagem no direct. Liga sozinho quando o post for publicado no Instagram.</span>
              </span>
            </label>
            {miniChat.enabled && (
              <div className="mt-3 flex flex-col gap-3">
                <label className={`flex flex-col gap-1 ${FIELD_LABEL}`}>
                  Palavra-chave
                  <input value={miniChat.keyword} onChange={(e) => setMiniChat((m) => ({ ...m, keyword: e.target.value }))} placeholder='Ex.: QUERO' className={INPUT} />
                  <span className="text-xs font-normal text-[#98A2B3]">Vale se o comentário contiver a palavra, sem diferenciar maiúscula de minúscula.</span>
                </label>
                <label className={`flex flex-col gap-1 ${FIELD_LABEL}`}>
                  Mensagem no direct
                  <textarea value={miniChat.responseText} onChange={(e) => setMiniChat((m) => ({ ...m, responseText: e.target.value }))} rows={3} placeholder="Oi! Aqui está o link que você pediu..." className="w-full min-w-0 resize-y rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#FF2B00]" />
                </label>
                <label className={`flex flex-col gap-1 ${FIELD_LABEL}`}>
                  Respostas no comentário (opcional, uma por linha, sorteada a cada vez)
                  <textarea value={miniChat.publicReplies} onChange={(e) => setMiniChat((m) => ({ ...m, publicReplies: e.target.value }))} rows={2} placeholder={"Te mandei no direct!\nOlha seu direct 😉"} className="w-full min-w-0 resize-y rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#FF2B00]" />
                </label>
                <div className="flex flex-col gap-2">
                  <span className={FIELD_LABEL}>Botões com link no direct (opcional, até 3)</span>
                  {miniChat.buttons.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                      <input value={b.text} maxLength={20} onChange={(e) => setMiniChat((m) => ({ ...m, buttons: m.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }))} placeholder="Texto" className={INPUT} />
                      <input value={b.url} onChange={(e) => setMiniChat((m) => ({ ...m, buttons: m.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) }))} placeholder="https://..." className={INPUT} />
                      <button type="button" aria-label="Remover botão" onClick={() => setMiniChat((m) => ({ ...m, buttons: m.buttons.length > 1 ? m.buttons.filter((_, j) => j !== i) : [{ text: "", url: "" }] }))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#D0D5DD] bg-white text-[#667085] hover:text-[#B42318]">
                        <X size={15} aria-hidden />
                      </button>
                    </div>
                  ))}
                  {miniChat.buttons.length < 3 && (
                    <button type="button" onClick={() => setMiniChat((m) => ({ ...m, buttons: [...m.buttons, { text: "", url: "" }] }))} className="self-start text-xs font-semibold text-[#FF2B00]">
                      + Adicionar botão
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#667085]">Para sequência com atraso, perguntas ou etiquetas, edite depois em Automações → Instagram.</p>
              </div>
            )}
          </div>
        )}

        {!instant && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={`flex min-w-0 flex-col gap-1 ${FIELD_LABEL}`}>
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
                className={INPUT}
              />
            </label>
            {platforms.length === 0 ? (
              <label className={`flex min-w-0 flex-col gap-1 ${FIELD_LABEL}`}>
                Hora (Brasília)
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
              </label>
            ) : (
              <PlatformTimeFields
                platforms={platforms}
                date={date}
                times={Object.fromEntries(platforms.map((p) => [p, timeOf(p)]))}
                onChange={(p, value) => setOverrides((prev) => ({ ...prev, [p]: value }))}
                labelClass={FIELD_LABEL}
              />
            )}
          </div>
        )}

        {progress && <p className="text-sm text-[#667085]">{progress}</p>}
        {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm text-[#B42318]">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {canNow && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void submit(true)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${
                instant ? "text-white" : "border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F6F7FB]"
              }`}
              style={instant ? { backgroundColor: "#FF2B00" } : undefined}
            >
              <Zap size={16} aria-hidden />
              {busy === "now" ? "Publicando..." : "Publicar agora"}
            </button>
          )}
          {!instant && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void submit(false)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              <CalendarClock size={16} aria-hidden />
              {busy === "schedule" ? "Agendando..." : platforms.length === 0 ? "Agendar" : `Agendar para ${[...new Set(platforms.map(timeOf))].join(" / ")}`}
            </button>
          )}
        </div>
      </fieldset>
      <aside className="min-w-0 md:sticky md:top-0 md:self-start">
        <PostPreview
          platforms={platforms}
          format={format}
          media={previewMedia}
          caption={caption}
          profiles={previewProfiles}
          whenLabel={instant ? "Publicando agora" : `Agendado para ${date.split("-").reverse().slice(0, 2).join("/")} às ${timeOf("FACEBOOK")}`}
        />
      </aside>
    </div>
  );
}
