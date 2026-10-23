import { META_GRAPH_API_VERSION, MetaApiError } from "@/lib/meta-ads";

/**
 * Mini-chat de Instagram (Blueprint de Automações, seção 4). Correção de
 * 2026-10-23: mensageria do Instagram SÓ funciona pela "API do Instagram com
 * Login do Instagram" (token IGAA, `graph.instagram.com`) — o token de
 * Página (`graph.facebook.com`, usado pra publicar posts) nunca entrega
 * webhook de mensagem/comentário, por mais que a assinatura pareça aceita. O
 * Blueprint já avisava isso na seção 4.1; a tentativa inicial de reaproveitar
 * só o token de Página foi um erro corrigido depois de testar ao vivo.
 */
const GRAPH = `https://graph.instagram.com/v26.0`;
/** Chamadas que ainda usam o token de Página (listar mídia pra regra de comentário, ex.) continuam em graph.facebook.com. */
const PAGE_GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

function graphErrorMessage(body: unknown): string {
  const error = (body as { error?: { message?: string; error_user_msg?: string } } | null)?.error;
  return error?.error_user_msg ?? error?.message ?? "Erro na Graph API da Meta.";
}

async function graphPost<T>(base: string, path: string, params: Record<string, string>): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new MetaApiError(graphErrorMessage(body), response.status, body);
  return body as T;
}

async function graphGet<T>(base: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${base}${path}`);
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

/** DM direta ou resposta a story — `recipient.id` é o ID (Instagram-scoped) de quem mandou. */
export async function sendInstagramDirectMessage(igToken: string, igAccountId: string, igsid: string, payload: SendMessagePayload): Promise<void> {
  await graphPost(GRAPH, `/${igAccountId}/messages`, {
    access_token: igToken,
    recipient: JSON.stringify({ id: igsid }),
    message: buildMessageBody(payload),
  });
}

/**
 * Resposta privada a um comentário (vira DM) — só funciona até 7 dias depois
 * do comentário, uma vez por autor antes dele responder (limite da própria
 * Meta).
 */
export async function sendInstagramPrivateReplyToComment(
  igToken: string,
  igAccountId: string,
  commentId: string,
  payload: SendMessagePayload,
): Promise<void> {
  await graphPost(GRAPH, `/${igAccountId}/messages`, {
    access_token: igToken,
    recipient: JSON.stringify({ comment_id: commentId }),
    message: buildMessageBody(payload),
  });
}

/** Resposta pública visível embaixo do comentário. */
export async function sendInstagramPublicCommentReply(igToken: string, commentId: string, text: string): Promise<void> {
  await graphPost(GRAPH, `/${commentId}/replies`, { access_token: igToken, message: text });
}

/** Troca o token curto por um de longa duração (60 dias) — seção 4.1 do Blueprint, corrigida: esse token expira, precisa de refresh periódico. */
export async function exchangeForLongLivedInstagramToken(shortLivedToken: string, appSecret: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const result = await graphGet<{ access_token: string; expires_in: number }>(GRAPH, "/access_token", {
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken,
  });
  return { accessToken: result.access_token, expiresInSeconds: result.expires_in };
}

/** Renova um token de longa duração já existente (precisa ter pelo menos 24h de vida) — rodar antes dos 60 dias expirarem. */
export async function refreshInstagramToken(longLivedToken: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const result = await graphGet<{ access_token: string; expires_in: number }>(GRAPH, "/refresh_access_token", {
    grant_type: "ig_refresh_token",
    access_token: longLivedToken,
  });
  return { accessToken: result.access_token, expiresInSeconds: result.expires_in };
}

export interface InstagramTokenIdentity {
  id: string;
  /** Formato que aparece em `entry.id`/`recipient.id` nos webhooks — diferente do `id` acima (confirmado testando ao vivo em 2026-10-23). É esse que precisa ser guardado como `messagingAccountId`. */
  userId: string;
  username: string;
}

/** Confirma que o token é válido e devolve a conta dona dele — usado ao salvar o token colado manualmente. */
export async function fetchInstagramTokenIdentity(igToken: string): Promise<InstagramTokenIdentity> {
  const result = await graphGet<{ id: string; user_id: string; username: string }>(GRAPH, "/me", { fields: "id,user_id,username", access_token: igToken });
  return { id: result.id, userId: result.user_id, username: result.username };
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
  const result = await graphGet<{ data: Array<Record<string, string>> }>(PAGE_GRAPH, `/${igUserId}/media`, {
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
