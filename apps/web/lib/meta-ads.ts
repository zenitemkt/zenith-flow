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
export function getAppBaseUrl(): string {
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

export interface MetaCampaignInsightRow {
  campaignId: string;
  campaignName: string;
  /** `YYYY-MM-DD` — vem direto da Meta, já na granularidade diária (`time_increment=1`). */
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  reach: number;
  /** Soma de ações tipo "lead" do dia — aproximação do que o manual chama de "results" (seção 36), nunca a contagem completa de todas as ações. */
  results: number;
  resultValueCents: number;
}

interface RawMetaAction {
  action_type: string;
  value: string;
}

interface RawMetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: RawMetaAction[];
  action_values?: RawMetaAction[];
  date_start: string;
}

/**
 * A Meta não tem um único "tipo de resultado" universal — cada ação em
 * `actions` é um tipo diferente (clique em link, visualização de página,
 * lead etc.). Pra "results" (seção 36) ter um número com sentido pro painel,
 * somamos só as ações que representam um lead/formulário preenchido — é uma
 * aproximação deliberada, documentada, não a contagem de tudo que a conta fez.
 */
const LEAD_ACTION_TYPES = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];

function sumActionValues(actions: RawMetaAction[] | undefined): number {
  if (!actions) return 0;
  return actions
    .filter((action) => LEAD_ACTION_TYPES.includes(action.action_type))
    .reduce((sum, action) => sum + Number(action.value || 0), 0);
}

interface GraphPage<T> {
  data: T[];
  paging?: { next?: string };
}

/** Segue `paging.next` até acabar (ou até `maxPages`, para nunca ficar preso numa conta enorme). */
async function graphGetAll<T>(path: string, params: Record<string, string>, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  let page = await graphGet<GraphPage<T>>(path, params);
  for (let i = 1; ; i++) {
    out.push(...(page.data ?? []));
    const next = page.paging?.next;
    if (!next || i >= maxPages) break;
    const response = await fetch(next, { method: "GET" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (body as { error?: { message?: string } } | null)?.error?.message ?? "Erro na Graph API da Meta.";
      throw new MetaApiError(message, response.status, body);
    }
    page = body as GraphPage<T>;
  }
  return out;
}

/** Campanha como está na Meta agora (nome e situação), independente de ter tido entrega. */
export interface MetaCampaignInfo {
  id: string;
  name: string;
  /** ACTIVE, PAUSED, ARCHIVED, DELETED, IN_PROCESS, WITH_ISSUES... */
  effectiveStatus: string;
  startTime: string | null;
  stopTime: string | null;
}

interface RawMetaCampaign {
  id: string;
  name: string;
  effective_status?: string;
  start_time?: string;
  stop_time?: string;
}

const CAMPAIGN_FIELDS = "id,name,effective_status,start_time,stop_time";

function toCampaignInfo(raw: RawMetaCampaign): MetaCampaignInfo {
  return {
    id: raw.id,
    name: raw.name,
    effectiveStatus: raw.effective_status ?? "",
    startTime: raw.start_time ?? null,
    stopTime: raw.stop_time ?? null,
  };
}

/** Campanhas da conta (a Meta não lista aqui as arquivadas/excluídas — ver `fetchMetaCampaignById`). */
export async function fetchMetaCampaigns(accessToken: string, adAccountId: string): Promise<MetaCampaignInfo[]> {
  const rows = await graphGetAll<RawMetaCampaign>(`/${adAccountId}/campaigns`, {
    access_token: accessToken,
    fields: CAMPAIGN_FIELDS,
    limit: "200",
  });
  return rows.map(toCampaignInfo);
}

/** Uma campanha pelo ID — também devolve arquivadas e excluídas. `null` se a conta conectada não a enxerga. */
export async function fetchMetaCampaignById(accessToken: string, campaignId: string): Promise<MetaCampaignInfo | null> {
  try {
    const raw = await graphGet<RawMetaCampaign>(`/${campaignId}`, { access_token: accessToken, fields: CAMPAIGN_FIELDS });
    return raw?.id ? toCampaignInfo(raw) : null;
  } catch (error) {
    if (error instanceof MetaApiError) return null;
    throw error;
  }
}

/**
 * Situação da Meta → status do sistema. Campanha ligada cuja data de término
 * já passou aparece como "Concluída" no Gerenciador: aqui é Encerrada.
 * Situação desconhecida devolve `null` (não mexe no que está salvo).
 */
export function campaignStatusFromMeta(
  effectiveStatus: string,
  stopTime: string | null,
  now = new Date(),
): "ATIVA" | "PAUSADA" | "ENCERRADA" | null {
  const status = effectiveStatus.toUpperCase();
  if (status === "ARCHIVED" || status === "DELETED") return "ENCERRADA";
  if (status === "PAUSED") return "PAUSADA";
  if (status === "ACTIVE" || status === "IN_PROCESS" || status === "WITH_ISSUES") {
    const stop = stopTime ? new Date(stopTime) : null;
    return stop && !Number.isNaN(stop.getTime()) && stop.getTime() < now.getTime() ? "ENCERRADA" : "ATIVA";
  }
  return null;
}

/** Métricas diárias por campanha (seção 36/38) — `time_increment: "1"` já devolve uma linha por campanha por dia, sem precisar agregar manualmente. */
export async function fetchMetaCampaignInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string,
): Promise<MetaCampaignInsightRow[]> {
  // Paginado: 30 dias × campanhas passa fácil de uma página (antes cortava em 500 linhas).
  const data = await graphGetAll<RawMetaInsightRow>(`/${adAccountId}/insights`, {
    access_token: accessToken,
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values",
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    limit: "500",
  });
  return data.map((row) => ({
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    date: row.date_start,
    spendCents: Math.round(Number(row.spend || 0) * 100),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    reach: Number(row.reach || 0),
    results: sumActionValues(row.actions),
    resultValueCents: Math.round(sumActionValues(row.action_values) * 100),
  }));
}
