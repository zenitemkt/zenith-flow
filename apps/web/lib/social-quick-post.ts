import type { SocialPlatform, SocialPostFormat } from "@zenite-mkt/db";

/**
 * Publicação direta pelo Calendário (2026-10-21): o Kevin clica num dia,
 * escolhe cliente, redes, formato, arte e horário — sem precisar de um
 * cartão antes. Por baixo, o sistema cria a peça (pra ficar no histórico e
 * no Kanban) e usa o mesmo agendador do cartão.
 *
 * Regras puras aqui (sem banco), testadas em social-quick-post.test.ts.
 */

/** Ação gravada na auditoria ao criar a peça — é o que libera pular a aprovação do cliente. */
export const QUICK_POST_AUDIT_ACTION = "content.quick_post_created";

export const QUICK_POST_FORMAT_LABEL: Record<SocialPostFormat, string> = { FEED: "Feed", REEL: "Reels", STORY: "Stories" };

const PLATFORM_LABEL: Record<SocialPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE_BUSINESS: "Google" };

/** Título do cartão: o digitado; senão a 1ª linha da legenda; senão "Instagram · 25/10". */
export function quickPostTitle(input: { title: string; caption: string; platforms: SocialPlatform[]; date: string }): string {
  const typed = input.title.trim();
  if (typed) return typed.slice(0, 120);
  const firstLine = input.caption.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (firstLine) return firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}...` : firstLine;
  const [, month, day] = input.date.split("-");
  const networks = input.platforms.map((p) => PLATFORM_LABEL[p]).join(" + ") || "Publicação";
  return `${networks} · ${day}/${month}`;
}

/** Dia (AAAA-MM-DD) do instante no fuso de São Paulo (UTC-3, sem horário de verão). */
export function spDateOf(instant: Date): string {
  return new Date(instant.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Checagens que dependem só da arte escolhida — feitas no navegador antes de
 * criar qualquer coisa, pra não sobrar cartão pela metade. Mesmas regras de
 * scheduleContentPosts (que confere de novo no servidor).
 */
export function quickPostMediaError(input: {
  platforms: SocialPlatform[];
  format: SocialPostFormat;
  files: { type: string }[];
}): string | null {
  const count = input.files.length;
  const hasVideo = input.files.some((f) => f.type.startsWith("video/"));
  if (input.platforms.length === 0) return "Escolha pelo menos uma rede.";
  if (input.platforms.includes("INSTAGRAM") && count === 0) return "O Instagram precisa da arte. Escolha a imagem ou o vídeo.";
  if (input.format === "STORY" && count !== 1) return "Story aceita exatamente um arquivo.";
  if (input.format === "REEL" && (count !== 1 || !hasVideo)) return "Reels precisa de um único vídeo.";
  if (input.platforms.includes("FACEBOOK") && input.format === "STORY") {
    return "Story no Facebook ainda não é suportado — desmarque o Facebook ou use Feed.";
  }
  if (input.platforms.includes("FACEBOOK") && count > 1 && hasVideo) return "O Facebook não aceita carrossel com vídeo.";
  return null;
}
