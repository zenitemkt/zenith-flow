"use client";

import { useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, MoreHorizontal, Send, Share2, ThumbsUp } from "lucide-react";
import type { SocialPlatform, SocialPostFormat } from "@zenite-mkt/db";

export interface PreviewMedia {
  url: string;
  isVideo: boolean;
}

export interface PreviewProfile {
  name: string;
  /** @ do Instagram, sem o "@". */
  username?: string | null;
  avatarUrl?: string | null;
}

const NETWORK_LABEL: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook" };
/** O Instagram mostra ~125 caracteres da legenda antes do "mais". */
const IG_CUT = 125;
const FB_CUT = 240;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Avatar({ profile, size }: { profile: PreviewProfile; size: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E4E7EC] text-[10px] font-semibold text-[#475467]"
      style={{ width: size, height: size }}
    >
      {profile.avatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initialsOf(profile.name)
      )}
    </span>
  );
}

function Media({ item, className }: { item: PreviewMedia; className: string }) {
  return item.isVideo ? (
    <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className={className} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.url} alt="" className={className} />
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full w-full items-center justify-center bg-[#F2F4F7] px-4 text-center text-xs text-[#98A2B3]">{text}</div>;
}

/** Legenda com corte no "mais", como a rede mostra; clicar expande. */
function Caption({ lead, text, cut }: { lead?: string; text: string; cut: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > cut;
  const shown = open || !long ? text : `${text.slice(0, cut).trimEnd()}…`;
  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-[18px] text-[#101828]">
      {lead && <span className="mr-1 font-semibold">{lead}</span>}
      {shown}
      {long && !open && (
        <button type="button" onClick={() => setOpen(true)} className="ml-1 text-[#667085]">
          mais
        </button>
      )}
    </p>
  );
}

function Carousel({
  media,
  ratio,
  emptyText,
  index,
  onIndex,
}: {
  media: PreviewMedia[];
  ratio: string;
  emptyText: string;
  index: number;
  onIndex: (index: number) => void;
}) {
  const current = Math.min(index, Math.max(media.length - 1, 0));
  const setIndex = onIndex;
  return (
    <div className="relative w-full overflow-hidden bg-[#F2F4F7]" style={{ aspectRatio: ratio }}>
      {media.length === 0 ? (
        <Empty text={emptyText} />
      ) : (
        <>
          <Media item={media[current]!} className="h-full w-full object-cover" />
          {media.length > 1 && (
            <>
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                {current + 1}/{media.length}
              </span>
              {current > 0 && (
                <button type="button" aria-label="Anterior" onClick={() => setIndex(current - 1)} className="absolute left-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#101828]">
                  <ChevronLeft size={14} aria-hidden />
                </button>
              )}
              {current < media.length - 1 && (
                <button type="button" aria-label="Próxima" onClick={() => setIndex(current + 1)} className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#101828]">
                  <ChevronRight size={14} aria-hidden />
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function InstagramFeed({ profile, media, caption }: { profile: PreviewProfile; media: PreviewMedia[]; caption: string }) {
  const handle = profile.username || profile.name;
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(media.length - 1, 0));
  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar profile={profile} size={32} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#101828]">{handle}</span>
        <MoreHorizontal size={16} className="text-[#101828]" aria-hidden />
      </div>
      <Carousel media={media} ratio="4 / 5" emptyText="Anexe a arte para ver como fica" index={current} onIndex={setIndex} />
      <div className="relative flex items-center gap-3.5 px-3 pb-1 pt-3 text-[#101828]">
        <Heart size={22} aria-hidden />
        <MessageCircle size={22} aria-hidden />
        <Send size={22} aria-hidden />
        {media.length > 1 && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1 pt-1" aria-hidden>
            {media.slice(0, 10).map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === current ? "bg-[#0095F6]" : "bg-[#C7CCD4]"}`} />
            ))}
          </span>
        )}
        <Bookmark size={22} className="ml-auto" aria-hidden />
      </div>
      <div className="px-3 pb-3.5 pt-1.5">
        {caption ? <Caption lead={handle} text={caption} cut={IG_CUT} /> : <p className="text-[13px] leading-[18px] text-[#98A2B3]">A legenda aparece aqui.</p>}
      </div>
    </div>
  );
}

function VerticalFrame({ profile, media, caption, story }: { profile: PreviewProfile; media: PreviewMedia[]; caption: string; story: boolean }) {
  const handle = profile.username || profile.name;
  const first = media[0];
  return (
    <div className="relative mx-auto w-full max-w-[230px] overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "9 / 16" }}>
      {first ? <Media item={first} className="h-full w-full object-cover" /> : <Empty text="Anexe a arte para ver como fica" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/55" />
      {story && <div className="absolute inset-x-3 top-2.5 h-0.5 rounded-full bg-white/80" />}
      <div className={`absolute inset-x-3 flex items-center gap-2 ${story ? "top-5" : "bottom-4"}`}>
        {story ? (
          <>
            <Avatar profile={profile} size={26} />
            <span className="truncate text-xs font-semibold text-white">{handle}</span>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-12 text-white">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Avatar profile={profile} size={22} />
              <span className="truncate">{handle}</span>
            </span>
            {caption && <p className="line-clamp-2 break-words text-[11px] leading-[15px]">{caption}</p>}
          </div>
        )}
      </div>
      {!story && (
        <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4 text-white">
          <Heart size={20} aria-hidden />
          <MessageCircle size={20} aria-hidden />
          <Send size={20} aria-hidden />
        </div>
      )}
    </div>
  );
}

function FacebookPost({ profile, media, caption, whenLabel }: { profile: PreviewProfile; media: PreviewMedia[]; caption: string; whenLabel: string }) {
  const first = media[0];
  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <div className="flex items-center gap-2.5 px-3 py-3">
        <Avatar profile={profile} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#101828]">{profile.name}</p>
          <p className="truncate text-[11px] text-[#667085]">{whenLabel}</p>
        </div>
        <MoreHorizontal size={16} className="text-[#667085]" aria-hidden />
      </div>
      {caption && (
        <div className="px-3 pb-3">
          <Caption text={caption} cut={FB_CUT} />
        </div>
      )}
      <div className="relative w-full bg-[#F2F4F7]">
        {first ? (
          <>
            <Media item={first} className="block max-h-[420px] w-full object-cover" />
            {media.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">+{media.length - 1} fotos</span>
            )}
          </>
        ) : (
          <div className="h-48">
            <Empty text="Anexe a arte para ver como fica" />
          </div>
        )}
      </div>
      <div className="mx-3 grid grid-cols-3 border-t border-[#EEF0F3] py-2 text-[11px] font-medium text-[#667085]">
        <span className="flex min-w-0 items-center justify-center gap-1">
          <ThumbsUp size={14} className="shrink-0" aria-hidden /> <span className="truncate">Curtir</span>
        </span>
        <span className="flex min-w-0 items-center justify-center gap-1">
          <MessageCircle size={14} className="shrink-0" aria-hidden /> <span className="truncate">Comentar</span>
        </span>
        <span className="flex min-w-0 items-center justify-center gap-1">
          <Share2 size={14} className="shrink-0" aria-hidden /> <span className="truncate">Enviar</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Simulação de como a publicação vai aparecer (Instagram feed/Reels/Story e
 * Facebook). É aproximada: serve para ver enquadramento da arte e quanto da
 * legenda aparece antes do "mais", não para ser pixel-perfect.
 */
export function PostPreview({
  platforms,
  format,
  media,
  caption,
  profiles,
  whenLabel,
}: {
  platforms: SocialPlatform[];
  format: SocialPostFormat;
  media: PreviewMedia[];
  caption: string;
  profiles: Partial<Record<SocialPlatform, PreviewProfile>>;
  /** Ex.: "Agendado para 29/10 às 13:00". */
  whenLabel: string;
}) {
  const networks: SocialPlatform[] = platforms.filter((p) => p === "INSTAGRAM" || p === "FACEBOOK");
  const [picked, setPicked] = useState<SocialPlatform | null>(null);
  if (networks.length === 0) return null;
  const platform = picked && networks.includes(picked) ? picked : networks[0]!;
  const profile = profiles[platform] ?? { name: "Seu perfil" };
  const text = format === "STORY" ? "" : caption;

  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Pré-visualização</span>
        {networks.length > 1 && (
          <div className="flex gap-1">
            {networks.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPicked(p)}
                aria-pressed={p === platform}
                className={`h-7 rounded-md px-2 text-xs font-medium ${p === platform ? "bg-[#101828] text-white" : "border border-[#E4E7EC] text-[#475467]"}`}
              >
                {NETWORK_LABEL[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {platform === "INSTAGRAM" && format === "FEED" && <InstagramFeed profile={profile} media={media} caption={text} />}
      {platform === "INSTAGRAM" && format !== "FEED" && <VerticalFrame profile={profile} media={media} caption={text} story={format === "STORY"} />}
      {platform === "FACEBOOK" && <FacebookPost profile={profile} media={media} caption={text} whenLabel={whenLabel} />}

      <p className="text-center text-[11px] leading-4 text-[#98A2B3]">Simulação aproximada: o visual final pode variar um pouco em cada aparelho.</p>
    </div>
  );
}
