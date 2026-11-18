/**
 * Uma peça (cartão) pode ter várias redes e vários formatos: o designer faz a mesma arte e
 * replica a prancheta em cada tamanho (ex.: Instagram 1080×1350 + Stories 1080×1920 +
 * LinkedIn 1080×1080). `channels`/`formats` são as listas; `channel`/`format` continuam
 * guardando o primeiro item, para o que já existia (cartões antigos só têm esses dois).
 */
import { CONTENT_CHANNEL_LABELS } from "./content";

type Channel = keyof typeof CONTENT_CHANNEL_LABELS;

export const CONTENT_CHANNELS = Object.keys(CONTENT_CHANNEL_LABELS) as Channel[];
export const CONTENT_FORMATS = ["Post estático", "Carrossel", "Stories", "Reels", "Vídeo", "Outro"] as const;

/** Redes da peça; cartões antigos (lista vazia) caem no canal único. */
export function contentChannels(item: { channel: string; channels?: string[] | null }): Channel[] {
  const list = item.channels?.length ? item.channels : [item.channel];
  return list.filter((c): c is Channel => c in CONTENT_CHANNEL_LABELS);
}

/** Formatos da peça; cartões antigos caem no formato único (texto livre). */
export function contentFormats(item: { format?: string | null; formats?: string[] | null }): string[] {
  if (item.formats?.length) return item.formats;
  return item.format ? [item.format] : [];
}

export function channelsLabel(item: { channel: string; channels?: string[] | null }) {
  return contentChannels(item).map((c) => CONTENT_CHANNEL_LABELS[c]).join(" + ");
}

export function formatsLabel(item: { format?: string | null; formats?: string[] | null }) {
  return contentFormats(item).join(" + ");
}

/** "Instagram + LinkedIn · Post estático + Stories" */
export function channelsAndFormatsLabel(item: { channel: string; channels?: string[] | null; format?: string | null; formats?: string[] | null }) {
  const formats = formatsLabel(item);
  return formats ? `${channelsLabel(item)} · ${formats}` : channelsLabel(item);
}

const FEED = { INSTAGRAM: "1080×1350", FACEBOOK: "1080×1350", LINKEDIN: "1080×1080" } as const;
const VERTICAL = { INSTAGRAM: "1080×1920", FACEBOOK: "1080×1920", TIKTOK: "1080×1920", YOUTUBE: "1080×1920" } as const;

/** Tamanho da arte por formato e rede; rede ausente = combinação que não existe (ex.: Stories no LinkedIn). */
const ART_SIZES: Record<string, Partial<Record<Channel, string>>> = {
  "Post estático": FEED,
  Carrossel: FEED,
  Stories: VERTICAL,
  Reels: VERTICAL,
  Vídeo: { ...FEED, TIKTOK: "1080×1920", YOUTUBE: "1280×720" },
};

export interface ArtSize {
  channel: Channel;
  format: string;
  /** null = sem tamanho padrão (rede "Outro" ou formato "Outro"/livre). */
  size: string | null;
}

/** Lista de pranchetas a entregar: cada rede × formato que existe, com o tamanho. */
export function artSizes(channels: string[], formats: string[]): ArtSize[] {
  const out: ArtSize[] = [];
  for (const channel of channels.filter((c): c is Channel => c in CONTENT_CHANNEL_LABELS)) {
    for (const format of formats) {
      const table = ART_SIZES[format];
      if (!table || channel === "OUTRO") {
        out.push({ channel, format, size: null });
        continue;
      }
      const size = table[channel];
      if (size) out.push({ channel, format, size });
    }
  }
  return out;
}

/** Limpa a lista vinda da API: só valores conhecidos (redes) / texto não vazio (formatos), sem repetição. */
export function parseChannels(value: unknown): Channel[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((c): c is Channel => typeof c === "string" && c in CONTENT_CHANNEL_LABELS)));
}

export function parseFormats(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((f): f is string => typeof f === "string").map((f) => f.trim().slice(0, 60)).filter(Boolean))).slice(0, 10);
}
