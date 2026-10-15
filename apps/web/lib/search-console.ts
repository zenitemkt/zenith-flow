/**
 * Cliente da Google Search Console API (seção "Pesquisa real do GSC" das
 * regras do blog, 2026-10-15) — só leitura (searchAnalytics.query), pra
 * priorizar o tema do artigo diário pela pesquisa real dos últimos 7 dias.
 * OAuth 2.0 offline (refresh_token, mesmo espírito do GBP do blueprint) —
 * sem SDK oficial, poucas chamadas, mesmo padrão de `lib/meta-ads.ts`.
 */

const SEARCH_CONSOLE_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"] as const;

function requireEnv(name: "GOOGLE_SEARCH_CONSOLE_CLIENT_ID" | "GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

function getAppBaseUrl(): string {
  return process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.hubzenite.com.br";
}

export function getSearchConsoleRedirectUri(): string {
  return `${getAppBaseUrl()}/api/admin/search-console-oauth/callback`;
}

/** `access_type=offline` + `prompt=consent` garante um refresh_token novo mesmo se a pessoa já tiver autorizado antes. */
export function buildSearchConsoleAuthorizeUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getSearchConsoleRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SEARCH_CONSOLE_SCOPES.join(" "));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export class SearchConsoleApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SearchConsoleApiError";
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export async function exchangeSearchConsoleCode(code: string): Promise<TokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"),
      redirect_uri: getSearchConsoleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new SearchConsoleApiError(`Falha ao trocar code por token: ${response.status}`, response.status);
  return (await response.json()) as TokenResponse;
}

async function refreshSearchConsoleAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new SearchConsoleApiError(`Falha ao renovar access_token: ${response.status}`, response.status);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/** Lista os sites que essa conta Google enxerga no Search Console — usado só na hora de conectar, pra escolher o site certo. */
export async function listSearchConsoleSites(accessToken: string): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new SearchConsoleApiError(`Falha ao listar sites: ${response.status}`, response.status);
  const data = (await response.json()) as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
  return data.siteEntry ?? [];
}

export interface SearchConsoleQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Top queries dos últimos `days` dias (padrão 7) pro site conectado, ordenadas por impressão. */
export async function fetchRecentSearchQueries(
  refreshToken: string,
  siteUrl: string,
  days = 7,
  rowLimit = 25,
): Promise<SearchConsoleQueryRow[]> {
  const accessToken = await refreshSearchConsoleAccessToken(refreshToken);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  const format = (d: Date) => d.toISOString().slice(0, 10);

  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: format(startDate),
      endDate: format(endDate),
      dimensions: ["query"],
      rowLimit,
    }),
  });
  if (!response.ok) throw new SearchConsoleApiError(`Falha ao consultar searchAnalytics: ${response.status}`, response.status);
  const data = (await response.json()) as { rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> };
  return (data.rows ?? []).map((row) => ({
    query: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}
