import { META_GRAPH_API_VERSION, MetaApiError } from "@/lib/meta-ads";

/**
 * Mini-chat de Instagram (Blueprint de Automações, seção 4) — construído
 * direto na API oficial, usando o MESMO token de Página já guardado em
 * `SocialConnection` (platform INSTAGRAM) que o agendador de redes usa pra
 * publicar. `graph.facebook.com`, não `graph.instagram.com`: essa é a rota
 * de token de Página (Facebook Login for Business), não o produto mais novo
 * de "Instagram Login" standalone (token IGAA) — evita o token de 60 dias
 * daquele outro fluxo, já que o token de Página de um usuário de longa
 * duração não expira.
 */
const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

function graphErrorMessage(body: unknown): string {
  const error = (body as { error?: { message?: string; error_user_msg?: string } } | null)?.error;
  return error?.error_user_msg ?? error?.message ?? "Erro na Graph API da Meta.";
}

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new MetaApiError(graphErrorMessage(body), response.status, body);
  return body as T;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new MetaApiError(graphErrorMessage(body), response.status, body);
  return body as T;
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

interface SendMessagePayload {
  text: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
}

function buildMessageBody(payload: SendMessagePayload): string {
  if (!payload.buttonText || !payload.buttonUrl) return JSON.stringify({ text: payload.text });
  return JSON.stringify({
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: payload.text,
        buttons: [{ type: "web_url", url: payload.buttonUrl, title: payload.buttonText.slice(0, 20) }],
      },
    },
  });
}

/** DM direta ou resposta a story — `recipient.id` é o IGSID de quem mandou. */
export async function sendInstagramDirectMessage(pageToken: string, igsid: string, payload: SendMessagePayload): Promise<void> {
  await graphPost("/me/messages", {
    access_token: pageToken,
    recipient: JSON.stringify({ id: igsid }),
    message: buildMessageBody(payload),
  });
}

/**
 * Resposta privada a um comentário (vira DM) — precisa do `pageId` na URL
 * (não `/me/messages`) e só funciona até 7 dias depois do comentário, uma
 * vez por autor antes dele responder (limite da própria Meta).
 */
export async function sendInstagramPrivateReplyToComment(
  pageToken: string,
  pageId: string,
  commentId: string,
  payload: SendMessagePayload,
): Promise<void> {
  await graphPost(`/${pageId}/messages`, {
    access_token: pageToken,
    recipient: JSON.stringify({ comment_id: commentId }),
    message: buildMessageBody(payload),
  });
}

/** Resposta pública visível embaixo do comentário. */
export async function sendInstagramPublicCommentReply(pageToken: string, commentId: string, text: string): Promise<void> {
  await graphPost(`/${commentId}/replies`, { access_token: pageToken, message: text });
}

/**
 * Liga o webhook do app pra essa Página — sem isso a Meta nunca manda
 * evento, mesmo com o webhook já configurado no painel do app (esse passo é
 * por Página/cliente, não é global).
 */
export async function subscribeInstagramWebhook(pageToken: string, pageId: string): Promise<void> {
  await graphPost(`/${pageId}/subscribed_apps`, {
    access_token: pageToken,
    subscribed_fields: "messages,messaging_postbacks,messaging_seen,comments",
  });
}

export interface RecentMediaItem {
  id: string;
  caption: string | null;
  permalink: string;
  mediaType: string;
  thumbnailUrl: string | null;
  timestamp: string;
}

/** Posts/reels recentes da conta — pra tela de regra "este comentário só nesse post". */
export async function fetchRecentInstagramMedia(pageToken: string, igUserId: string): Promise<RecentMediaItem[]> {
  const result = await graphGet<{ data: Array<Record<string, string>> }>(`/${igUserId}/media`, {
    access_token: pageToken,
    fields: "id,caption,permalink,media_type,thumbnail_url,media_url,timestamp",
    limit: "30",
  });
  return result.data.map((item) => ({
    id: item.id!,
    caption: item.caption ?? null,
    permalink: item.permalink!,
    mediaType: item.media_type!,
    thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
    timestamp: item.timestamp!,
  }));
}

// ---------------------------------------------------------------------------
// Casamento de regra (Blueprint, seção 4.3)
// ---------------------------------------------------------------------------

export interface MatchableRule {
  id: string;
  triggerType: string;
  keyword: string | null;
  mediaId: string | null;
  active: boolean;
}

/**
 * Ordem de prioridade: (post específico + palavra-chave) → (qualquer post +
 * palavra-chave) → (post específico, pega-tudo) → (qualquer post,
 * pega-tudo). `mediaId`/`keyword` só importam de verdade pra comentário —
 * story/DM não têm post associado, então a dimensão de mídia nunca entra.
 */
export function matchInstagramRule<T extends MatchableRule>(
  rules: T[],
  input: { triggerType: string; text: string | null; mediaId?: string | null },
): T | null {
  const candidates = rules.filter((rule) => rule.active && rule.triggerType === input.triggerType);
  const textLower = (input.text ?? "").toLowerCase();
  const keywordMatches = (rule: T) => Boolean(rule.keyword && textLower.includes(rule.keyword.toLowerCase()));
  const mediaMatches = (rule: T) => rule.mediaId === null || rule.mediaId === input.mediaId;

  const tiers: Array<(rule: T) => boolean> = [
    (rule) => rule.mediaId !== null && keywordMatches(rule) && mediaMatches(rule),
    (rule) => rule.mediaId === null && keywordMatches(rule),
    (rule) => rule.mediaId !== null && !rule.keyword && mediaMatches(rule),
    (rule) => rule.mediaId === null && !rule.keyword,
  ];
  for (const tier of tiers) {
    const found = candidates.find(tier);
    if (found) return found;
  }
  return null;
}

/** Sorteia uma variação de resposta pública (seção 4.3 — "pra não repetir sempre a mesma frase"). */
export function pickPublicReplyVariation(variations: string[]): string | null {
  if (variations.length === 0) return null;
  return variations[Math.floor(Math.random() * variations.length)]!;
}
