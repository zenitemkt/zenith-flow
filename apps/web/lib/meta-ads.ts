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
 * métricas de campanha), `business_management` (listar contas de anúncio
 * do Business Manager) e `ads_management` (Gestor de tráfego: enviar
 * criativos e criar/pausar anúncios, sempre com aprovação na tela — 2026-11-13).
 */
export const META_OAUTH_SCOPES = ["ads_read", "business_management", "ads_management"] as const;

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

export interface RawMetaAction {
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
function actionValue(actions: RawMetaAction[] | undefined, type: string): number | null {
  const found = actions?.find((action) => action.action_type === type);
  return found ? Number(found.value || 0) : null;
}

/**
 * Leads do dia sem dupla contagem: "lead" já é o total (formulário instantâneo + pixel).
 * Só quando ele não vem, soma as partes (formulário + pixel). Antes somava as três e
 * contava o mesmo lead duas ou três vezes.
 */
export function leadCount(actions: RawMetaAction[] | undefined): number {
  const total = actionValue(actions, "lead");
  if (total !== null) return total;
  return (actionValue(actions, "onsite_conversion.lead_grouped") ?? 0) + (actionValue(actions, "offsite_conversion.fb_pixel_lead") ?? 0);
}

/** Valor de compras (para ROAS), sem somar os tipos que se repetem. */
function purchaseValue(values: RawMetaAction[] | undefined): number {
  return actionValue(values, "omni_purchase") ?? actionValue(values, "purchase") ?? actionValue(values, "offsite_conversion.fb_pixel_purchase") ?? 0;
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
  /** Orçamento diário da campanha (Advantage+), em centavos; null = verba nos conjuntos. */
  dailyBudgetCents: number | null;
}

interface RawMetaCampaign {
  id: string;
  name: string;
  effective_status?: string;
  start_time?: string;
  stop_time?: string;
  daily_budget?: string;
}

const CAMPAIGN_FIELDS = "id,name,effective_status,start_time,stop_time,daily_budget";

function toCampaignInfo(raw: RawMetaCampaign): MetaCampaignInfo {
  return {
    id: raw.id,
    name: raw.name,
    effectiveStatus: raw.effective_status ?? "",
    startTime: raw.start_time ?? null,
    stopTime: raw.stop_time ?? null,
    dailyBudgetCents: raw.daily_budget ? Number(raw.daily_budget) : null,
  };
}

/**
 * Todas as campanhas da conta, inclusive pausadas e arquivadas (sem o filtro,
 * a Meta deixa as arquivadas de fora). Se a Meta recusar o filtro, busca sem
 * ele — melhor trazer as ativas/pausadas do que falhar a sincronização.
 */
const ALL_CAMPAIGN_STATUSES = JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"]);

export async function fetchMetaCampaigns(accessToken: string, adAccountId: string): Promise<MetaCampaignInfo[]> {
  try {
    const rows = await graphGetAll<RawMetaCampaign>(`/${adAccountId}/campaigns`, {
      access_token: accessToken,
      fields: CAMPAIGN_FIELDS,
      effective_status: ALL_CAMPAIGN_STATUSES,
      limit: "200",
    });
    return rows.map(toCampaignInfo);
  } catch (error) {
    if (!(error instanceof MetaApiError) || error.status !== 400) throw error;
  }
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
    results: leadCount(row.actions),
    resultValueCents: Math.round(purchaseValue(row.action_values) * 100),
  }));
}


// ---------------------------------------------------------------------------
// Raio X fase 2A: conjuntos, anúncios, números por nível e coordenadas das cidades.

export interface MetaAdSetInfo {
  id: string;
  name: string;
  campaignId: string;
  effectiveStatus: string;
  dailyBudgetCents: number | null;
  cities: { key: string; name: string; radiusKm: number | null }[];
  /** Locais marcados por endereço/pino (já vêm com latitude e longitude). */
  pins: { key: string; name: string; lat: number; lng: number; radiusKm: number | null }[];
  targetingSummary: string;
}

interface RawMetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: {
      cities?: { key: string; name?: string; region?: string; radius?: number; distance_unit?: string }[];
      custom_locations?: { latitude?: number; longitude?: number; radius?: number; distance_unit?: string; name?: string; address_string?: string }[];
      regions?: { name?: string }[];
      countries?: string[];
    };
    custom_audiences?: { name?: string }[];
  };
}

function targetingSummary(t: RawMetaAdSet["targeting"]): string {
  if (!t) return "";
  const parts: string[] = [];
  const cities = t.geo_locations?.cities ?? [];
  const pins = t.geo_locations?.custom_locations ?? [];
  if (cities.length || pins.length)
    parts.push(
      [
        ...cities.map((c) => `${c.name ?? c.key}${c.radius ? ` (+${c.radius} ${c.distance_unit === "mile" ? "mi" : "km"})` : ""}`),
        ...pins.map((c) => `${c.name || c.address_string || "ponto no mapa"}${c.radius ? ` (raio ${c.radius} ${c.distance_unit === "mile" ? "mi" : "km"})` : ""}`),
      ].join(", "),
    );
  else if (t.geo_locations?.regions?.length) parts.push(t.geo_locations.regions.map((r) => r.name).filter(Boolean).join(", "));
  else if (t.geo_locations?.countries?.length) parts.push(t.geo_locations.countries.join(", "));
  if (t.age_min || t.age_max) parts.push(`${t.age_min ?? 18}–${t.age_max ?? 65} anos`);
  if (t.genders?.length === 1) parts.push(t.genders[0] === 1 ? "homens" : "mulheres");
  if (t.custom_audiences?.length) parts.push(`remarketing: ${t.custom_audiences.map((a) => a.name).filter(Boolean).join(", ")}`);
  return parts.join(" · ").slice(0, 500);
}

const ALL_ADSET_STATUSES = JSON.stringify(["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"]);

export async function fetchMetaAdSets(accessToken: string, adAccountId: string): Promise<MetaAdSetInfo[]> {
  const rows = await graphGetAll<RawMetaAdSet>(`/${adAccountId}/adsets`, {
    access_token: accessToken,
    fields: "id,name,campaign_id,effective_status,daily_budget,lifetime_budget,targeting{age_min,age_max,genders,geo_locations,custom_audiences}",
    // Conjunto de campanha pausada vem como CAMPAIGN_PAUSED: sem isso no filtro, a Meta não devolve nenhum.
    effective_status: ALL_ADSET_STATUSES,
    limit: "200",
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    campaignId: r.campaign_id,
    effectiveStatus: r.effective_status ?? "",
    dailyBudgetCents: r.daily_budget ? Number(r.daily_budget) : null,
    cities: (r.targeting?.geo_locations?.cities ?? []).map((c) => ({
      key: c.key,
      name: [c.name, c.region].filter(Boolean).join(", ") || c.key,
      radiusKm: c.radius ? (c.distance_unit === "mile" ? c.radius * 1.609 : c.radius) : null,
    })),
    pins: (r.targeting?.geo_locations?.custom_locations ?? [])
      .filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number")
      .map((c) => ({
        key: `pin:${c.latitude!.toFixed(4)},${c.longitude!.toFixed(4)}`,
        name: c.name || c.address_string || `Ponto ${c.latitude!.toFixed(3)}, ${c.longitude!.toFixed(3)}`,
        lat: c.latitude!,
        lng: c.longitude!,
        radiusKm: c.radius ? (c.distance_unit === "mile" ? c.radius * 1.609 : c.radius) : null,
      })),
    targetingSummary: targetingSummary(r.targeting),
  }));
}

export interface MetaAdInfo {
  id: string;
  name: string;
  adSetId: string;
  effectiveStatus: string;
  reviewFeedback: string | null;
  thumbnailUrl: string | null;
}

interface RawMetaAd {
  id: string;
  name: string;
  adset_id: string;
  effective_status?: string;
  ad_review_feedback?: { global?: Record<string, string>; placement_specific?: Record<string, Record<string, string>> };
  creative?: { thumbnail_url?: string; image_url?: string };
}

const ALL_AD_STATUSES = JSON.stringify(["ACTIVE", "PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ADSET_PAUSED"]);

export async function fetchMetaAds(accessToken: string, adAccountId: string): Promise<MetaAdInfo[]> {
  const rows = await graphGetAll<RawMetaAd>(`/${adAccountId}/ads`, {
    access_token: accessToken,
    fields: "id,name,adset_id,effective_status,ad_review_feedback,creative{thumbnail_url,image_url}",
    effective_status: ALL_AD_STATUSES,
    thumbnail_width: "256",
    thumbnail_height: "256",
    limit: "200",
  });
  return rows.map((r) => {
    const feedback = [...Object.values(r.ad_review_feedback?.global ?? {}), ...Object.values(r.ad_review_feedback?.placement_specific ?? {}).flatMap((x) => Object.values(x))];
    return {
      id: r.id,
      name: r.name,
      adSetId: r.adset_id,
      effectiveStatus: r.effective_status ?? "",
      reviewFeedback: feedback.length ? Array.from(new Set(feedback)).join(" ").slice(0, 2000) : null,
      thumbnailUrl: r.creative?.thumbnail_url ?? r.creative?.image_url ?? null,
    };
  });
}

export interface MetaLevelInsightRow {
  /** ID do conjunto ou do anúncio, conforme o nível. */
  id: string;
  date: string;
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  leads: number;
}

interface RawLevelInsightRow {
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: RawMetaAction[];
  date_start: string;
}

/** Números diários por conjunto ou por anúncio. */
export async function fetchMetaLevelInsights(accessToken: string, adAccountId: string, level: "adset" | "ad", since: string, until: string): Promise<MetaLevelInsightRow[]> {
  const data = await graphGetAll<RawLevelInsightRow>(`/${adAccountId}/insights`, {
    access_token: accessToken,
    level,
    fields: `${level === "ad" ? "ad_id" : "adset_id"},spend,impressions,reach,clicks,inline_link_clicks,actions`,
    time_range: JSON.stringify({ since, until }),
    time_increment: "1",
    limit: "500",
  }, 40);
  return data
    .map((row) => ({
      id: (level === "ad" ? row.ad_id : row.adset_id) ?? "",
      date: row.date_start,
      spendCents: Math.round(Number(row.spend || 0) * 100),
      impressions: Number(row.impressions || 0),
      reach: Number(row.reach || 0),
      clicks: Number(row.clicks || 0),
      linkClicks: Number(row.inline_link_clicks || 0),
      leads: leadCount(row.actions),
    }))
    .filter((row) => row.id);
}

/** Latitude/longitude das cidades da segmentação (busca de localização da própria Meta). */
export async function fetchMetaCityCoordinates(accessToken: string, keys: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>();
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50);
    try {
      const data = await graphGet<{ data?: { cities?: Record<string, { latitude?: number; longitude?: number }> } | { cities?: Record<string, { latitude?: number; longitude?: number }> }[] }>("/search", {
        access_token: accessToken,
        type: "adgeolocationmeta",
        cities: JSON.stringify(chunk),
      });
      const blocks = Array.isArray(data.data) ? data.data : data.data ? [data.data] : [];
      for (const block of blocks) {
        for (const [key, value] of Object.entries(block.cities ?? {})) {
          if (typeof value.latitude === "number" && typeof value.longitude === "number") out.set(key, { lat: value.latitude, lng: value.longitude });
        }
      }
    } catch (error) {
      console.warn("meta_city_coordinates_failed", error instanceof Error ? error.message : error);
    }
  }
  return out;
}
