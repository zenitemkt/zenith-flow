import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { metaGet } from "@/lib/meta-marketing";
import { emptyPlan, type PlanAdSet, type TrafficPlan } from "@/lib/traffic-campaigns";

/**
 * Incluir em campanha que já está na Meta: novos conjuntos (com criativos) ou só novos
 * anúncios num conjunto existente. Lê da Meta o que precisa para continuar a numeração
 * ([03], AD04), o tipo de orçamento e, para anúncios, o formulário e o link do conjunto.
 */
const ALL = JSON.stringify(["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED"]);

const numberIn = (name: string, re: RegExp) => Number(name.match(re)?.[1] ?? 0);

interface CreativeSpec {
  object_story_spec?: { link_data?: { link?: string; call_to_action?: { value?: { lead_gen_form_id?: string; link?: string } } }; video_data?: { call_to_action?: { value?: { lead_gen_form_id?: string; link?: string } } } };
  asset_feed_spec?: { link_urls?: { website_url?: string }[]; call_to_actions?: { value?: { lead_gen_form_id?: string } }[] };
}

export async function buildExtendPlan(agencyId: string, mode: "ADD_ADSETS" | "ADD_ADS", metaCampaignId: string, metaAdSetId?: string | null): Promise<TrafficPlan> {
  const ads = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } }, select: { accessTokenEnc: true, status: true } });
  if (!ads || ads.status !== "ACTIVE") throw new Error("Conta de anúncios da Meta não conectada.");
  const token = decryptSecret(ads.accessTokenEnc);

  const campaign = await metaGet<{ name: string; daily_budget?: string; lifetime_budget?: string }>(`/${metaCampaignId}`, token, { fields: "name,daily_budget,lifetime_budget" });
  const adSets = await metaGet<{ data?: { id: string; name: string }[] }>(`/${metaCampaignId}/adsets`, token, { fields: "id,name", effective_status: ALL, limit: 200 });
  const setList = adSets.data ?? [];
  const campaignNumber = numberIn(campaign.name, /^\s*\[[A-Z]+(\d+)\]/) || 1;
  const adSetOffset = Math.max(setList.length, ...setList.map((s) => numberIn(s.name, /^\s*\[(\d+)\]/)));
  const cbo = Boolean(campaign.daily_budget || campaign.lifetime_budget);

  const plan: TrafficPlan = {
    ...emptyPlan(),
    name: campaign.name,
    mode,
    budgetMode: cbo ? "CAMPAIGN" : "ADSET",
    target: { metaCampaignId, campaignName: campaign.name, campaignNumber, campaignBudget: cbo, adSetOffset, metaAdSetId: null, adSetName: null, adSetNumber: null, adOffset: 0, formId: null, linkUrl: null },
  };
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId }, select: { urlTags: true } });
  if (settings?.urlTags) plan.urlTags = settings.urlTags;
  if (mode === "ADD_ADSETS") return plan;

  if (!metaAdSetId) throw new Error("Escolha o conjunto.");
  const set = await metaGet<{ name: string; optimization_goal?: string }>(`/${metaAdSetId}`, token, { fields: "name,optimization_goal" });
  const existingAds = await metaGet<{ data?: { name: string; creative?: CreativeSpec }[] }>(`/${metaAdSetId}/ads`, token, { fields: "name,creative{object_story_spec,asset_feed_spec}", effective_status: ALL, limit: 200 });
  const adList = existingAds.data ?? [];
  let formId: string | null = null;
  let linkUrl: string | null = null;
  for (const ad of adList) {
    const c = ad.creative;
    formId ??= c?.object_story_spec?.link_data?.call_to_action?.value?.lead_gen_form_id ?? c?.object_story_spec?.video_data?.call_to_action?.value?.lead_gen_form_id ?? c?.asset_feed_spec?.call_to_actions?.find((x) => x.value?.lead_gen_form_id)?.value?.lead_gen_form_id ?? null;
    linkUrl ??= c?.object_story_spec?.link_data?.link ?? c?.object_story_spec?.link_data?.call_to_action?.value?.link ?? c?.asset_feed_spec?.link_urls?.[0]?.website_url ?? null;
  }
  const conversion = set.optimization_goal === "LEAD_GENERATION" ? "FORM" : "SITE";
  if (conversion === "FORM" && !formId) throw new Error("Não achei o formulário instantâneo dos anúncios desse conjunto. Use \"+ Conjuntos e criativos\" para criar um conjunto novo com formulário.");
  const index = setList.findIndex((s) => s.id === metaAdSetId);
  plan.conversion = conversion;
  plan.target = {
    ...plan.target!,
    metaAdSetId,
    adSetName: set.name,
    adSetNumber: numberIn(set.name, /^\s*\[(\d+)\]/) || index + 1 || 1,
    adOffset: Math.max(adList.length, ...adList.map((a) => numberIn(a.name, /AD(\d+)/i))),
    formId,
    linkUrl,
  };
  const existing: PlanAdSet = {
    key: "existing",
    niche: "",
    cities: [],
    geoMode: "CITY",
    radiusKm: 17,
    temperature: "FRIO",
    customAudiences: [],
    advantage: true,
    ageMin: 25,
    ageMax: 55,
    gender: 0,
    interests: [],
    dailyBudget: 0,
    form: { introTitle: "", introBullets: [], introText: "", contactText: "", privacyLinkText: "", askCity: false, questions: [], thankTitle: "", thankBody: "", buttonText: "", buttonUrl: "" },
    destinationUrl: linkUrl ?? "",
    creativeIds: [],
  };
  plan.adsets = [existing];
  return plan;
}
