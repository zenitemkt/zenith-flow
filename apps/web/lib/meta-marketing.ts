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
  /** Saudação em lista (até 5 itens). Vazio = usa `introText` como parágrafo. */
  introBullets: string[];
  introText: string;
  cityOptions: string[];
  customQuestions: { label: string; options: string[] }[];
  /** Texto acima dos dados de contato ("Usamos seus dados apenas para..."). */
  contactText: string;
  thankTitle: string;
  thankBody: string;
  buttonText: string;
  buttonUrl: string;
  privacyUrl: string;
  privacyLinkText: string;
}

/**
 * Formulário instantâneo no padrão da Zenite: tipo "maior intenção" (tela de revisão),
 * compartilhamento aberto, saudação em lista, perguntas personalizadas primeiro (múltipla
 * escolha antes de resposta curta) e os dados de contato no fim.
 */
export async function createLeadForm(pageToken: string, pageId: string, spec: LeadFormSpec): Promise<string> {
  const questions: object[] = [];
  if (spec.cityOptions.length) {
    questions.push({ type: "CUSTOM", key: "cidade", label: "Em qual cidade fica a sua empresa?", options: spec.cityOptions.map((value, i) => ({ value, key: `cidade_${i + 1}` })) });
  }
  // A Meta exige resposta curta depois das de múltipla escolha.
  const ordered = [...spec.customQuestions.filter((q) => q.options.length), ...spec.customQuestions.filter((q) => !q.options.length)];
  ordered.forEach((q, index) => {
    const key = `pergunta_${index + 1}`;
    questions.push(q.options.length ? { type: "CUSTOM", key, label: q.label, options: q.options.map((value, i) => ({ value, key: `${key}_${i + 1}` })) } : { type: "CUSTOM", key, label: q.label });
  });
  questions.push({ type: "FULL_NAME" }, { type: "EMAIL" }, { type: "PHONE" });
  const bullets = spec.introBullets.map((b) => b.trim().slice(0, 80)).filter(Boolean).slice(0, 5);
  const data = await metaPost<{ id: string }>(`/${pageId}/leadgen_forms`, pageToken, {
    name: spec.name.slice(0, 200),
    locale: "pt_BR",
    is_optimized_for_quality: true,
    block_display_for_non_targeted_viewer: false,
    questions,
    question_page_custom_headline: spec.contactText ? spec.contactText.slice(0, 200) : undefined,
    privacy_policy: { url: spec.privacyUrl, link_text: (spec.privacyLinkText || "Política de privacidade").slice(0, 70) },
    context_card: bullets.length
      ? { title: spec.introTitle.slice(0, 60), style: "LIST_STYLE", content: bullets }
      : { title: spec.introTitle.slice(0, 60), style: "PARAGRAPH_STYLE", content: [spec.introText.slice(0, 1000)] },
    thank_you_page: { title: spec.thankTitle.slice(0, 60), body: spec.thankBody.slice(0, 500), button_type: "VIEW_WEBSITE", button_text: spec.buttonText.slice(0, 60), website_url: spec.buttonUrl },
  }, "criar formulário instantâneo");
  return data.id;
}

/** Com `dailyBudgetCents`: orçamento da campanha (Advantage+), a Meta distribui entre os conjuntos. */
export async function createCampaign(token: string, adAccountId: string, name: string, dailyBudgetCents?: number | null): Promise<string> {
  const budget = dailyBudgetCents ? { daily_budget: dailyBudgetCents, bid_strategy: "LOWEST_COST_WITHOUT_CAP" } : { is_adset_budget_sharing_enabled: false };
  const data = await metaPost<{ id: string }>(`/${act(adAccountId)}/campaigns`, token, {
    name,
    objective: "OUTCOME_LEADS",
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
    ...budget,
  }, "criar campanha");
  return data.id;
}

export interface AdSetSpec {
  name: string;
  campaignId: string;
  pageId: string;
  /** null = orçamento fica na campanha (Advantage+). */
  dailyBudgetCents: number | null;
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
    ...(spec.dailyBudgetCents ? { daily_budget: spec.dailyBudgetCents, bid_strategy: "LOWEST_COST_WITHOUT_CAP" } : {}),
    billing_event: "IMPRESSIONS",
    ...conversion,
    targeting,
    // Conjunto e anúncio nascem ativos; a campanha pausada segura a veiculação até você ativar.
    status: "ACTIVE",
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
  /** Até 5 de cada: a Meta testa as combinações (Advantage+ de criativo). */
  messages: string[];
  headlines: string[];
  descriptions: string[];
  callToAction: string;
  imageHash?: string | null;
  /** Versão vertical: com ela, o anúncio usa a imagem de Stories em Stories/Status/Reels e a de Feed no resto. */
  storiesImageHash?: string | null;
  videoId?: string | null;
  videoThumbUrl?: string | null;
  /** Parâmetros de URL (UTMs) acrescentados ao link. */
  urlTags?: string | null;
  /** Liga as melhorias do Advantage+ de criativo. */
  advantageCreative: boolean;
}

/** Botão padrão: "Ver detalhes" (GET_DETAILS na API). */
export const DEFAULT_CTA = "GET_DETAILS";

/**
 * Melhorias do Advantage+ de criativo, todas ligadas (nomes da referência AdCreativeFeaturesSpec, v27).
 * O pacote "standard_enhancements" foi descontinuado na v22: mandar ele derrubava o pedido inteiro.
 * As que não valem para o formato a Meta descarta sozinha; as que ela recusar saem uma a uma.
 */
const CREATIVE_FEATURES = [
  "image_touchups",
  "adapt_to_placement",
  "add_text_overlay",
  "image_animation",
  "image_templates",
  "text_optimizations",
  "inline_comment",
  "description_automation",
  "reveal_details_over_time",
  "generate_cta",
  "show_summary",
  "image_background_gen",
];

export async function createAdCreative(token: string, adAccountId: string, spec: AdCreativeSpec): Promise<string> {
  const cta = spec.formId ? { type: spec.callToAction || DEFAULT_CTA, value: { lead_gen_form_id: spec.formId } } : { type: spec.callToAction || DEFAULT_CTA, value: { link: spec.linkUrl } };
  const story: Record<string, unknown> = { page_id: spec.pageId };
  if (spec.instagramUserId) story.instagram_user_id = spec.instagramUserId;
  const messages = spec.messages.map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const headlines = spec.headlines.map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const descriptions = spec.descriptions.map((t) => t.trim()).filter(Boolean).slice(0, 5);
  const pair = Boolean(spec.imageHash && spec.storiesImageHash && !spec.videoId);
  const multi = messages.length > 1 || headlines.length > 1 || descriptions.length > 1;

  const params: Record<string, string | object> = { name: spec.name, object_story_spec: story };
  if (spec.urlTags) params.url_tags = spec.urlTags;

  if (pair || multi) {
    // No par Feed/Stories a Meta só aplica nas regras de posicionamento os textos que a regra cita
    // pelo rótulo; sem rótulo o anúncio sobe sem texto. Todos os textos levam o mesmo rótulo.
    const label = (name: string) => (pair ? { adlabels: [{ name }] } : {});
    const assetFeed: Record<string, unknown> = {
      bodies: messages.map((text) => ({ text, ...label("zf_body") })),
      titles: headlines.map((text) => ({ text, ...label("zf_title") })),
      ...(descriptions.length ? { descriptions: descriptions.map((text) => ({ text, ...label("zf_desc") })) } : {}),
      link_urls: [{ website_url: spec.linkUrl, ...label("zf_link") }],
      call_to_action_types: [cta.type],
      ...(spec.formId ? { call_to_actions: [cta] } : {}),
    };
    if (spec.videoId) {
      assetFeed.videos = [{ video_id: spec.videoId, thumbnail_url: spec.videoThumbUrl ?? undefined }];
      assetFeed.ad_formats = ["SINGLE_VIDEO"];
    } else if (pair) {
      const textLabels = { body_label: { name: "zf_body" }, title_label: { name: "zf_title" }, link_url_label: { name: "zf_link" }, ...(descriptions.length ? { description_label: { name: "zf_desc" } } : {}) };
      assetFeed.images = [{ hash: spec.imageHash, adlabels: [{ name: "feed" }] }, { hash: spec.storiesImageHash, adlabels: [{ name: "stories" }] }];
      assetFeed.ad_formats = ["SINGLE_IMAGE"];
      assetFeed.optimization_type = "PLACEMENT";
      assetFeed.asset_customization_rules = [
        {
          customization_spec: { publisher_platforms: ["facebook", "instagram", "messenger"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"], messenger_positions: ["story"] },
          image_label: { name: "stories" },
          ...textLabels,
          priority: 1,
        },
        {
          customization_spec: {
            publisher_platforms: ["facebook", "instagram", "audience_network", "messenger"],
            facebook_positions: ["feed", "marketplace", "video_feeds", "search", "instream_video"],
            instagram_positions: ["stream", "explore", "explore_home", "profile_feed", "ig_search"],
            audience_network_positions: ["classic"],
            messenger_positions: ["messenger_home"],
          },
          image_label: { name: "feed" },
          ...textLabels,
          priority: 2,
        },
      ];
    } else {
      assetFeed.images = [{ hash: spec.imageHash }];
      assetFeed.ad_formats = ["SINGLE_IMAGE"];
    }
    params.asset_feed_spec = assetFeed;
  } else if (spec.videoId) {
    story.video_data = { video_id: spec.videoId, image_url: spec.videoThumbUrl ?? undefined, message: messages[0], title: headlines[0], link_description: descriptions[0], call_to_action: cta };
  } else {
    story.link_data = { image_hash: spec.imageHash, link: spec.linkUrl, message: messages[0], name: headlines[0], description: descriptions[0], call_to_action: cta };
  }

  const id = await postCreative(token, adAccountId, spec, params);
  // Confere se a Meta guardou o texto (já aconteceu de aceitar o criativo e descartar os textos).
  const saved = await metaGet<{ body?: string; title?: string; asset_feed_spec?: { bodies?: unknown[]; titles?: unknown[] }; object_story_spec?: { link_data?: { message?: string }; video_data?: { message?: string } } }>(`/${id}`, token, { fields: "body,title,asset_feed_spec,object_story_spec" }).catch(() => null);
  if (saved && messages.length) {
    const hasText = Boolean(saved.body || saved.asset_feed_spec?.bodies?.length || saved.object_story_spec?.link_data?.message || saved.object_story_spec?.video_data?.message);
    if (!hasText) throw new MetaWriteError(`A Meta criou o criativo "${spec.name}" sem o texto principal. Nada foi publicado; me avise para ajustar o formato.`, 0);
  }
  return id;
}

async function postCreative(token: string, adAccountId: string, spec: AdCreativeSpec, params: Record<string, string | object>): Promise<string> {
  const post = () => metaPost<{ id: string }>(`/${act(adAccountId)}/adcreatives`, token, params, `criar criativo "${spec.name}"`).then((r) => r.id);
  if (!spec.advantageCreative) return post();
  let features = [...CREATIVE_FEATURES];
  for (let attempt = 0; attempt < 8 && features.length; attempt++) {
    params.degrees_of_freedom_spec = { creative_features_spec: Object.fromEntries(features.map((f) => [f, { enroll_status: "OPT_IN" }])) };
    try {
      return await post();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("adcreative_features_retry", features.join(","), message);
      // Tira a melhoria citada no erro; sem citação, tira as menos comuns primeiro (do fim da lista).
      const named = features.filter((f) => message.includes(f));
      features = named.length ? features.filter((f) => !named.includes(f)) : features.slice(0, -2);
    }
  }
  delete params.degrees_of_freedom_spec;
  return post();
}

/** Anúncio ativo (a campanha segue pausada), com rastreamento dos eventos do site (pixel) e offline (conjunto de dados). */
export async function createAd(token: string, adAccountId: string, name: string, adSetId: string, creativeId: string, tracking?: { pixelId?: string | null; datasetId?: string | null }): Promise<string> {
  const specs: object[] = [];
  if (tracking?.pixelId) specs.push({ "action.type": ["offsite_conversion"], fb_pixel: [tracking.pixelId] });
  if (tracking?.datasetId) specs.push({ "action.type": ["offline_conversion"], dataset: [tracking.datasetId] });
  const data = await metaPost<{ id: string }>(`/${act(adAccountId)}/ads`, token, { name, adset_id: adSetId, creative: { creative_id: creativeId }, status: "ACTIVE", ...(specs.length ? { tracking_specs: specs } : {}) }, `criar anúncio "${name}"`);
  return data.id;
}

export async function pageInstagramId(pageToken: string, pageId: string): Promise<string | null> {
  const data = await metaGet<{ instagram_business_account?: { id: string } }>(`/${pageId}`, pageToken, { fields: "instagram_business_account" }).catch(() => ({}) as { instagram_business_account?: { id: string } });
  return data.instagram_business_account?.id ?? null;
}
