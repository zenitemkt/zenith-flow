import { META_GRAPH_API_VERSION, MetaApiError, getMetaOAuthRedirectUri } from "@/lib/meta-ads";

/**
 * Agendador de redes (2026-10-20): conectar Página do Facebook + Instagram
 * profissional de um cliente e publicar neles. Mesmo app da Meta e mesma
 * URL de retorno do OAuth de Ads (`flow: "social"` no state separa os dois),
 * pra não precisar cadastrar outra URL no painel da Meta.
 *
 * Sem SDK, `fetch` direto na Graph API — mesmo padrão de lib/meta-ads.ts.
 */
const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

/**
 * Permissões do fluxo de publicação + mini-chat de Instagram (Blueprint de
 * Automações, seção 4 — reaproveita esta MESMA conexão/token de Página em
 * vez de um fluxo de OAuth separado, só com escopo a mais: `pages_messaging`
 * e `pages_manage_metadata`). `instagram_manage_messages`/
 * `instagram_manage_comments` foram tentados primeiro mas a Meta rejeita
 * esses dois nomes nesse app ("Invalid Scopes" direto no diálogo, antes de
 * mostrar a tela) — `pages_messaging` sozinho já é a permissão exigida pra
 * assinar os campos de mensagem (confirmado pelo próprio erro da API ao
 * tentar assinar o webhook). Em modo desenvolvimento do app, quem tem papel
 * no app (admin) pode usá-las sem App Review, nas Páginas que já administra
 * — o caso da Zenite hoje.
 */
export const META_SOCIAL_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;

function requireEnv(name: "META_APP_ID"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

export function buildMetaSocialAuthorizeUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", requireEnv("META_APP_ID"));
  url.searchParams.set("redirect_uri", getMetaOAuthRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SOCIAL_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  // Sempre mostra a tela de escolha de Páginas, mesmo que já tenha autorizado antes (pra incluir Páginas novas).
  url.searchParams.set("auth_type", "rerequest");
  return url.toString();
}

function graphErrorMessage(body: unknown): string {
  const error = (body as { error?: { message?: string; error_user_msg?: string; error_user_title?: string } } | null)?.error;
  return error?.error_user_msg ?? error?.message ?? "Erro na Graph API da Meta.";
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = path.startsWith("https://") ? new URL(path) : new URL(`${GRAPH}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new MetaApiError(graphErrorMessage(body), response.status, body);
  return body as T;
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

// ---------------------------------------------------------------------------
// Páginas e Instagram do usuário que autorizou
// ---------------------------------------------------------------------------

export interface MetaPageOption {
  id: string;
  name: string;
  accessToken: string;
  pictureUrl: string | null;
  instagram: { id: string; username: string | null; pictureUrl: string | null } | null;
}

interface RawPage {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
}

/**
 * Páginas que o usuário administra (inclui as dos clientes geridas pelo
 * Gerenciador de Negócios). O token de Página obtido a partir de um token de
 * usuário de longa duração não expira — é ele que guardamos.
 */
export async function fetchMetaPages(userAccessToken: string): Promise<MetaPageOption[]> {
  const pages: MetaPageOption[] = [];
  let next: string | null = `${GRAPH}/me/accounts`;
  let params: Record<string, string> = {
    access_token: userAccessToken,
    fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
    limit: "100",
  };
  for (let page = 0; next && page < 5; page++) {
    const result: { data: RawPage[]; paging?: { next?: string } } = await graphGet(next, params);
    for (const raw of result.data) {
      pages.push({
        id: raw.id,
        name: raw.name,
        accessToken: raw.access_token,
        pictureUrl: raw.picture?.data?.url ?? null,
        instagram: raw.instagram_business_account
          ? {
              id: raw.instagram_business_account.id,
              username: raw.instagram_business_account.username ?? null,
              pictureUrl: raw.instagram_business_account.profile_picture_url ?? null,
            }
          : null,
      });
    }
    next = result.paging?.next ?? null;
    params = {}; // a URL `next` já traz todos os parâmetros
  }
  return pages.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Publicação
// ---------------------------------------------------------------------------

export interface PublishMedia {
  url: string;
  isVideo: boolean;
}

export interface PublishResult {
  externalPostId: string;
  permalink: string | null;
}

/** Erro que vale tentar de novo mais tarde (mídia ainda processando, instabilidade). */
export class RetryableSocialError extends Error {
  constructor(
    message: string,
    public readonly containerId?: string,
  ) {
    super(message);
    this.name = "RetryableSocialError";
  }
}

// ----- Facebook (Página) -----

export async function publishToFacebookPage(input: {
  pageId: string;
  token: string;
  caption: string;
  media: PublishMedia[];
}): Promise<PublishResult> {
  const { pageId, token, caption, media } = input;
  let postId: string;

  if (media.length === 0) {
    postId = (await graphPost<{ id: string }>(`/${pageId}/feed`, { access_token: token, message: caption })).id;
  } else if (media.length === 1 && media[0]!.isVideo) {
    const video = await graphPost<{ id: string }>(`/${pageId}/videos`, {
      access_token: token,
      file_url: media[0]!.url,
      description: caption,
    });
    postId = video.id;
  } else if (media.length === 1) {
    const photo = await graphPost<{ id: string; post_id?: string }>(`/${pageId}/photos`, {
      access_token: token,
      url: media[0]!.url,
      caption,
    });
    postId = photo.post_id ?? photo.id;
  } else {
    if (media.some((m) => m.isVideo)) {
      throw new Error("O Facebook não aceita carrossel com vídeo. Publique só imagens ou um vídeo sozinho.");
    }
    // Várias fotos: sobe cada uma sem publicar e cria um único post com todas.
    const attached: Record<string, string> = {};
    for (const [index, item] of media.entries()) {
      const photo = await graphPost<{ id: string }>(`/${pageId}/photos`, {
        access_token: token,
        url: item.url,
        published: "false",
      });
      attached[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photo.id });
    }
    postId = (await graphPost<{ id: string }>(`/${pageId}/feed`, { access_token: token, message: caption, ...attached })).id;
  }

  let permalink: string | null = null;
  try {
    permalink = (await graphGet<{ permalink_url?: string }>(`/${postId}`, { access_token: token, fields: "permalink_url" })).permalink_url ?? null;
  } catch {
    // Vídeo recém-enviado ainda não tem post consultável — sem link, mas publicado.
  }
  return { externalPostId: postId, permalink };
}

// ----- Instagram -----

type IgFormat = "FEED" | "REEL" | "STORY";

async function igContainerStatus(containerId: string, token: string): Promise<string> {
  const result = await graphGet<{ status_code?: string }>(`/${containerId}`, { access_token: token, fields: "status_code" });
  return result.status_code ?? "FINISHED";
}

/** Espera o container (vídeo) ficar pronto dentro do tempo disponível; devolve o último status. */
async function waitForContainer(containerId: string, token: string, budgetMs: number): Promise<string> {
  const deadline = Date.now() + budgetMs;
  let status = await igContainerStatus(containerId, token);
  while (status === "IN_PROGRESS" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    status = await igContainerStatus(containerId, token);
  }
  return status;
}

async function createIgItemContainer(
  igUserId: string,
  token: string,
  item: PublishMedia,
  opts: { caption?: string; format: IgFormat; carouselItem?: boolean },
): Promise<string> {
  const params: Record<string, string> = { access_token: token };
  if (opts.carouselItem) {
    params.is_carousel_item = "true";
    if (item.isVideo) {
      params.media_type = "VIDEO";
      params.video_url = item.url;
    } else params.image_url = item.url;
  } else if (opts.format === "STORY") {
    params.media_type = "STORIES";
    if (item.isVideo) params.video_url = item.url;
    else params.image_url = item.url;
  } else if (item.isVideo) {
    params.media_type = "REELS";
    params.video_url = item.url;
    params.share_to_feed = "true";
  } else {
    params.image_url = item.url;
  }
  if (opts.caption && opts.format !== "STORY" && !opts.carouselItem) params.caption = opts.caption;
  return (await graphPost<{ id: string }>(`/${igUserId}/media`, params)).id;
}

/**
 * Publica no Instagram: cria o container (ou os filhos + carrossel), espera
 * vídeo processar e publica. Se o vídeo não ficar pronto no tempo da função,
 * lança `RetryableSocialError` com o `containerId` — o cron termina depois
 * via `finishInstagramContainer`.
 */
export async function publishToInstagram(input: {
  igUserId: string;
  token: string;
  caption: string;
  media: PublishMedia[];
  format: IgFormat;
  budgetMs: number;
}): Promise<PublishResult> {
  const { igUserId, token, caption, media, format, budgetMs } = input;
  if (media.length === 0) throw new Error("O Instagram exige pelo menos uma imagem ou vídeo.");
  if (format === "STORY" && media.length > 1) throw new Error("Story aceita um arquivo só.");
  const started = Date.now();
  const remaining = () => Math.max(0, budgetMs - (Date.now() - started));

  let containerId: string;
  if (media.length === 1) {
    containerId = await createIgItemContainer(igUserId, token, media[0]!, { caption, format });
  } else {
    const children: string[] = [];
    for (const item of media) children.push(await createIgItemContainer(igUserId, token, item, { format, carouselItem: true }));
    for (const child of children) {
      const status = await waitForContainer(child, token, remaining());
      if (status === "IN_PROGRESS") throw new RetryableSocialError("Vídeos do carrossel ainda processando no Instagram.");
      if (status !== "FINISHED") throw new Error(`Um item do carrossel falhou no Instagram (${status}).`);
    }
    containerId = (
      await graphPost<{ id: string }>(`/${igUserId}/media`, {
        access_token: token,
        media_type: "CAROUSEL",
        children: children.join(","),
        caption,
      })
    ).id;
  }

  return finishInstagramContainer({ igUserId, token, containerId, budgetMs: remaining() });
}

export async function finishInstagramContainer(input: {
  igUserId: string;
  token: string;
  containerId: string;
  budgetMs: number;
}): Promise<PublishResult> {
  const { igUserId, token, containerId, budgetMs } = input;
  const status = await waitForContainer(containerId, token, budgetMs);
  if (status === "IN_PROGRESS") throw new RetryableSocialError("Vídeo ainda processando no Instagram.", containerId);
  if (status === "EXPIRED") throw new Error("O preparo da mídia expirou no Instagram (24h). Agende de novo.");
  if (status !== "FINISHED") throw new Error(`O Instagram recusou a mídia (${status}). Confira formato e tamanho.`);

  const published = await graphPost<{ id: string }>(`/${igUserId}/media_publish`, { access_token: token, creation_id: containerId });
  let permalink: string | null = null;
  try {
    permalink = (await graphGet<{ permalink?: string }>(`/${published.id}`, { access_token: token, fields: "permalink" })).permalink ?? null;
  } catch {
    // sem link, mas publicado
  }
  return { externalPostId: published.id, permalink };
}
