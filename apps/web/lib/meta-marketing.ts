import { META_GRAPH_API_VERSION } from "@/lib/meta-ads";

/**
 * Escrita na Marketing API da Meta (Gestor de tráfego). Tudo nasce PAUSADO: quem ativa é a equipe.
 * Erros da Meta viram `MetaWriteError` com a mensagem amigável que a própria Meta devolve.
 */
const GRAPH = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export class MetaWriteError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | object | undefined>;

function encode(params: Params): URLSearchParams {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    body.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return body;
}

async function parse<T>(response: Response, what: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as { error?: unknown }).error) {
    const error = (data as { error?: { message?: string; error_user_title?: string; error_user_msg?: string; code?: number } }).error;
    const friendly = error?.error_user_msg || error?.error_user_title || error?.message || `erro ${response.status}`;
    throw new MetaWriteError(`Meta (${what}): ${friendly}`, error?.code);
  }
  return data as T;
}

export async function metaGet<T>(path: string, token: string, params: Params = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of encode({ ...params, access_token: token })) url.searchParams.set(k, v);
  return parse<T>(await fetch(url, { cache: "no-store" }), path);
}

export async function metaPost<T>(path: string, token: string, params: Params, what = path): Promise<T> {
  return parse<T>(await fetch(`${GRAPH}${path}`, { method: "POST", body: encode({ ...params, access_token: token }) }), what);
}

const act = (adAccountId: string) => (adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`);

/** Cidade brasileira → chave de localização da Meta (prefere o estado de São Paulo). */
export async function findCityKey(token: string, name: string): Promise<{ key: string; name: string; region: string } | null> {
  const data = await metaGet<{ data?: { key: string; name: string; region?: string; country_code?: string }[] }>("/search", token, {
    type: "adgeolocation",
    location_types: ["city"],
    q: name,
    country_code: "BR",
    limit: 10,
  });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  const list = (data.data ?? []).filter((c) => !c.country_code || c.country_code === "BR");
  const exact = list.filter((c) => norm(c.name) === norm(name));
  const pick = exact.find((c) => (c.region ?? "").includes("Paulo")) ?? exact[0] ?? list.find((c) => (c.region ?? "").includes("Paulo")) ?? list[0];
  return pick ? { key: pick.key, name: pick.name, region: pick.region ?? "" } : null;
}

export async function searchInterests(token: string, q: string): Promise<{ id: string; name: string; audience?: number }[]> {
  const data = await metaGet<{ data?: { id: string; name: string; audience_size_upper_bound?: number }[] }>("/search", token, { type: "adinterest", q, limit: 15, locale: "pt_BR" });
  return (data.data ?? []).map((i) => ({ id: i.id, name: i.name, audience: i.audience_size_upper_bound }));
}

export async function uploadAdImage(token: string, adAccountId: string, bytes: Buffer, fileName: string): Promise<string> {
  const data = await metaPost<{ images?: Record<string, { hash: string }> }>(`/${act(adAccountId)}/adimages`, token, { bytes: bytes.toString("base64"), name: fileName }, "enviar imagem");
  const hash = Object.values(data.images ?? {})[0]?.hash;
  if (!hash) throw new MetaWriteError("Meta (enviar imagem): resposta sem o código da imagem.");
  return hash;
}

export async function uploadAdVideo(token: string, adAccountId: string, bytes: Buffer, fileName: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("access_token", token);
  form.append("name", fileName);
  form.append("source", new Blob([new Uint8Array(bytes)], { type: mimeType }), fileName);
  const data = await parse<{ id?: string }>(await fetch(`${GRAPH}/${act(adAccountId)}/advideos`, { method: "POST", body: form }), "enviar vídeo");
  if (!data.id) throw new MetaWriteError("Meta (enviar vídeo): resposta sem o código do vídeo.");
  return data.id;
}

/** Vídeo precisa terminar de processar e ter miniatura antes de virar anúncio. */
export async function videoReadyThumbnail(token: string, videoId: string): Promise<string | null> {
  const video = await metaGet<{ status?: { video_status?: string } }>(`/${videoId}`, token, { fields: "status" });
  if (video.status?.video_status && video.status.video_status !== "ready") return null;
  const thumbs = await metaGet<{ data?: { uri: string; is_preferred?: boolean }[] }>(`/${videoId}/thumbnails`, token);
  const list = thumbs.data ?? [];
  return (list.find((t) => t.is_preferred) ?? list[0])?.uri ?? null;
}

export interface LeadFormSpec {
  name: string;
  introTitle: string;
  introText: string;
  cityOptions: string[];
  customQuestions: { label: string; options: string[] }[];
  thankTitle: string;
  thankBody: string;
  buttonText: string;
  buttonUrl: string;
  privacyUrl: string;
}

/** Formulário instantâneo (vinculado à página que assina o anúncio; abre dentro do anúncio). */
export async function createLeadForm(pageToken: string, pageId: string, spec: LeadFormSpec): Promise<string> {
  const questions: object[] = [{ type: "FULL_NAME" }, { type: "PHONE" }, { type: "EMAIL" }];
  if (spec.cityOptions.length) {
    questions.push({ type: "CUSTOM", key: "cidade", label: "Em qual cidade fica a sua empresa?", options: spec.cityOptions.map((value, i) => ({ value, key: `cidade_${i + 1}` })) });
  }
  spec.customQuestions.forEach((q, index) => {
    const key = `pergunta_${index + 1}`;
    questions.push(q.options.length ? { type: "CUSTOM", key, label: q.label, options: q.options.map((value, i) => ({ value, key: `${key}_${i + 1}` })) } : { type: "CUSTOM", key, label: q.label });
  });
  const data = await metaPost<{ id: string }>(`/${pageId}/leadgen_forms`, pageToken, {
    name: spec.name.slice(0, 200),
    locale: "pt_BR",
    questions,
    privacy_policy: { url: spec.privacyUrl, link_text: "Política de privacidade" },
    context_card: { title: spec.introTitle.slice(0, 60), style: "PARAGRAPH_STYLE", content: [spec.introText.slice(0, 1000)] },
    thank_you_page: { title: spec.thankTitle.slice(0, 60), body: spec.thankBody.slice(0, 500), button_type: "VIEW_WEBSITE", button_text: spec.buttonText.slice(0, 30), website_url: spec.buttonUrl },
    block_display_for_non_targeted_viewer: true,
  }, "criar formulário instantâneo");
  return data.id;
}

export async function createCampaign(token: string, adAccountId: string, name: string): Promise<string> {
  const data = await metaPost<{ id: string }>(`/${act(adAccountId)}/campaigns`, token, {
    name,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
    is_adset_budget_sharing_enabled: false,
  }, "criar campanha");
  return data.id;
}

export interface AdSetSpec {
  name: string;
  campaignId: string;
  pageId: string;
  dailyBudgetCents: number;
  cityKeys: string[];
  /** "RADIUS" = cidade + raio; "CITY" = apenas a cidade (sem raio). */
  geoMode: "RADIUS" | "CITY";
  radiusKm: number;
  ageMin: number;
  ageMax: number;
  /** 0 = todos, 1 = homens, 2 = mulheres. */
  gender: 0 | 1 | 2;
  /** Advantage+ de público: idade, gênero e interesses viram sugestões, não limites. */
  advantage: boolean;
  interests: { id: string; name: string }[];
  /** Remarketing ([QUENTE]): públicos personalizados da conta. */
  customAudienceIds: string[];
  conversion: "FORM" | "SITE";
  pixelId?: string | null;
}

export async function createAdSet(token: string, adAccountId: string, spec: AdSetSpec): Promise<string> {
  const cities = spec.cityKeys.map((key) => (spec.geoMode === "RADIUS" ? { key, radius: spec.radiusKm, distance_unit: "kilometer" } : { key }));
  const targeting: Record<string, unknown> = {
    geo_locations: { cities },
    targeting_automation: { advantage_audience: spec.advantage ? 1 : 0 },
  };
  if (spec.advantage) {
    // Com Advantage+ a idade mínima é controle (até 25); a faixa e o gênero entram como sugestão.
    targeting.age_min = Math.min(spec.ageMin, 25);
    targeting.age_max = 65;
    targeting.age_range = [spec.ageMin, spec.ageMax];
  } else {
    targeting.age_min = spec.ageMin;
    targeting.age_max = spec.ageMax;
  }
  if (spec.gender) targeting.genders = [spec.gender];
  if (spec.interests.length) targeting.flexible_spec = [{ interests: spec.interests.map((i) => ({ id: i.id, name: i.name })) }];
  if (spec.customAudienceIds.length) targeting.custom_audiences = spec.customAudienceIds.map((id) => ({ id }));
  const conversion =
    spec.conversion === "SITE"
      ? { optimization_goal: "OFFSITE_CONVERSIONS", destination_type: "WEBSITE", promoted_object: { pixel_id: spec.pixelId, custom_event_type: "LEAD" } }
      : { optimization_goal: "LEAD_GENERATION", destination_type: "ON_AD", promoted_object: { page_id: spec.pageId } };
  const data = await metaPost<{ id: string }>(`/${act(adAccountId)}/adsets`, token, {
    name: spec.name,
    campaign_id: spec.campaignId,
    daily_budget: spec.dailyBudgetCents,
    billing_event: "IMPRESSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    ...conversion,
    targeting,
    status: "PAUSED",
  }, `criar conjunto "${spec.name}"`);
  return data.id;
}

export async function listCustomAudiences(token: string, adAccountId: string): Promise<{ id: string; name: string; size?: number }[]> {
  const data = await metaGet<{ data?: { id: string; name: string; approximate_count_lower_bound?: number }[] }>(`/${act(adAccountId)}/customaudiences`, token, { fields: "id,name,approximate_count_lower_bound", limit: 200 });
  return (data.data ?? []).map((a) => ({ id: a.id, name: a.name, size: a.approximate_count_lower_bound }));
}

export interface AdCreativeSpec {
  name: string;
  pageId: string;
  instagramUserId?: string | null;
  /** Formulário instantâneo; sem ele, o anúncio leva para `linkUrl` (site com pixel). */
  formId?: string | null;
  linkUrl: string;
  message: string;
  headline: string;
  description?: string | null;
  callToAction: string;
  imageHash?: string | null;
  videoId?: string | null;
  videoThumbUrl?: string | null;
}

export async function createAdCreative(token: string, adAccountId: string, spec: AdCreativeSpec): Promise<string> {
  const cta = spec.formId ? { type: spec.callToAction || "SIGN_UP", value: { lead_gen_form_id: spec.formId } } : { type: spec.callToAction || "LEARN_MORE", value: { link: spec.linkUrl } };
  const story: Record<string, unknown> = { page_id: spec.pageId };
  if (spec.instagramUserId) story.instagram_user_id = spec.instagramUserId;
  if (spec.videoId) {
    story.video_data = { video_id: spec.videoId, image_url: spec.videoThumbUrl ?? undefined, message: spec.message, title: spec.headline, link_description: spec.description ?? undefined, call_to_action: cta };
  } else {
    story.link_data = { image_hash: spec.imageHash, link: spec.linkUrl, message: spec.message, name: spec.headline, description: spec.description ?? undefined, call_to_action: cta };
  }
  const data = await metaPost<{ id: string }>(`/${act(adAccountId)}/adcreatives`, token, { name: spec.name, object_story_spec: story }, `criar criativo "${spec.name}"`);
  return data.id;
}

export async function createAd(token: string, adAccountId: string, name: string, adSetId: string, creativeId: string): Promise<string> {
  const data = await metaPost<{ id: string }>(`/${act(adAccountId)}/ads`, token, { name, adset_id: adSetId, creative: { creative_id: creativeId }, status: "PAUSED" }, `criar anúncio "${name}"`);
  return data.id;
}

export async function pageInstagramId(pageToken: string, pageId: string): Promise<string | null> {
  const data = await metaGet<{ instagram_business_account?: { id: string } }>(`/${pageId}`, pageToken, { fields: "instagram_business_account" }).catch(() => ({}) as { instagram_business_account?: { id: string } });
  return data.instagram_business_account?.id ?? null;
}
