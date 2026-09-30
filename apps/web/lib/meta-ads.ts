/**
 * Cliente da Meta Marketing API (seção 38 do manual — só o fluxo "Ads
 * Insights: conectar conta" nesta fatia; Conversions API e leitura
 * automática de campanhas ficam para as próximas). Sem SDK oficial — poucas
 * chamadas, feitas direto por `fetch` contra o Graph API, mesmo padrão de
 * "sem dependência nova pra pouca coisa" já usado no resto do projeto
 * (`lib/whatsapp.ts`, `lib/email.ts`).
 */

export const META_GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

/**
 * Permissões pedidas na autorização: `ads_read` (Ads Insights — estrutura e
 * métricas de campanha) e `business_management` (listar contas de anúncio
 * do Business Manager). `ads_management` fica de fora por enquanto — esta
 * fatia só lê, nunca cria/edita campanha (ver docs/DECISIONS.md).
 */
export const META_OAUTH_SCOPES = ["ads_read", "business_management"] as const;

function requireEnv(name: "META_APP_ID" | "META_APP_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

/** URL base do próprio app (sem barra final) — mesmo padrão de `MAIN_APP_URL` em `lib/auth.ts`. */
function getAppBaseUrl(): string {
  return process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.hubzenite.com.br";
}

export function getMetaOAuthRedirectUri(): string {
  return `${getAppBaseUrl()}/api/integrations/meta/oauth/callback`;
}

/** Monta a URL do diálogo de autorização da Meta. `state` é obrigatório (proteção CSRF, ver rota `oauth/start`). */
export function buildMetaAuthorizeUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", requireEnv("META_APP_ID"));
  url.searchParams.set("redirect_uri", getMetaOAuthRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_OAUTH_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { method: "GET" });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? "Erro na Graph API da Meta.";
    throw new MetaApiError(message, response.status, body);
  }
  return body as T;
}

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/** Troca o `code` do redirect por um token de curta duração (~1-2h). */
export async function exchangeMetaCodeForShortLivedToken(code: string): Promise<MetaTokenResponse> {
  return graphGet<MetaTokenResponse>("/oauth/access_token", {
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    redirect_uri: getMetaOAuthRedirectUri(),
    code,
  });
}

/**
 * Troca um token de curta duração por um de longa duração (~60 dias, seção
 * 38: "tokens criptografados e renovação monitorada"). Não existe refresh
 * token clássico na Meta — passado o prazo, a única saída é reconectar
 * (repetir o fluxo OAuth do zero), não um refresh silencioso.
 */
export async function exchangeMetaTokenForLongLived(shortLivedToken: string): Promise<MetaTokenResponse> {
  return graphGet<MetaTokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    fb_exchange_token: shortLivedToken,
  });
}

export interface MetaAdAccount {
  id: string; // já vem prefixado "act_<numero>"
  name: string;
  account_status: number;
  currency: string;
}

/** Contas de anúncio que o usuário autenticado administra (própria conta pessoal + Business Managers dela). */
export async function fetchMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const result = await graphGet<{ data: MetaAdAccount[] }>("/me/adaccounts", {
    access_token: accessToken,
    fields: "id,name,account_status,currency",
    limit: "50",
  });
  return result.data;
}
