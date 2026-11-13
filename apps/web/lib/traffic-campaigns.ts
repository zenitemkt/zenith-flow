import { prisma, Prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { downloadDriveFile, renameDriveFile } from "@/lib/google-drive";
import { standardCreativeName } from "@/lib/creative-pairing";
import { DEFAULT_URL_TAGS } from "@/lib/copy-split";
import { adsForAdSet, copyForAd, planDailyTotal } from "@/lib/traffic-copy";
export { adCopyKey, copyForAd, emptyCopy, planDailyTotal } from "@/lib/traffic-copy";
import { setCreativeStatus } from "@/lib/ad-creatives";
import { raiseSystemAlert, resolveSystemAlert } from "@/lib/system-alerts";
import { OBJECTIVE_CODES, nextCampaignNumber, withCampaignCode } from "@/lib/campaign-naming";
import {
  DEFAULT_CTA,
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
  createLeadForm,
  findCityKey,
  pageInstagramId,
  uploadAdImage,
  uploadAdVideo,
  videoReadyThumbnail,
} from "@/lib/meta-marketing";

/** Plano montado no passo a passo "Nova campanha". Valores de verba em reais. */
export interface PlanForm {
  introTitle: string;
  /** Saudação em lista (como o formulário da Zenite); vazio = parágrafo em introText. */
  introBullets: string[];
  introText: string;
  contactText: string;
  privacyLinkText: string;
  askCity: boolean;
  questions: { label: string; options: string[] }[];
  thankTitle: string;
  thankBody: string;
  buttonText: string;
  buttonUrl: string;
}
export interface PlanAdSet {
  key: string;
  /** Opcional: campanha para empresários em geral fica sem nicho. */
  niche: string;
  cities: string[];
  /** "RADIUS" = cidade + raio; "CITY" = apenas a cidade. */
  geoMode: "RADIUS" | "CITY";
  radiusKm: number;
  /** "FRIO" = público aberto; "QUENTE" = remarketing (públicos personalizados). */
  temperature: "FRIO" | "QUENTE";
  customAudiences: { id: string; name: string }[];
  /** Advantage+ de público ([AUTO]); idade, gênero e interesses viram sugestões. */
  advantage: boolean;
  ageMin: number;
  ageMax: number;
  /** 0 = todos, 1 = homens, 2 = mulheres. */
  gender: 0 | 1 | 2;
  interests: { id: string; name: string }[];
  dailyBudget: number;
  form: PlanForm;
  /** Destino quando a campanha é para o site (conversão no pixel). */
  destinationUrl: string;
  creativeIds: string[];
}
import type { PlanCopy } from "@/lib/traffic-copy";
export type { PlanCopy } from "@/lib/traffic-copy";
export interface TrafficPlan {
  name: string;
  /** "CAMPAIGN" = orçamento Advantage+ da campanha (padrão da Meta); "ADSET" = verba em cada conjunto. */
  budgetMode: "CAMPAIGN" | "ADSET";
  campaignDailyBudget: number;
  /** Textos de todos os anúncios (grupo 1, até 5 de cada). Vazio = usa os textos de cada criativo. */
  copy: PlanCopy;
  /** Liga os grupos de textos: cada anúncio escolhe o grupo em `copyByAd`. */
  splitCopy: boolean;
  /** Grupos 2, 3... (o grupo 1 é `copy`). */
  copyGroups: PlanCopy[];
  /** "chaveDoConjunto:idDoCriativoPrincipal" -> nº do grupo (0 = grupo 1). */
  copyByAd: Record<string, number>;
  /** Advantage+ de criativo com todas as melhorias. */
  advantageCreative: boolean;
  trackSiteEvents: boolean;
  trackOfflineEvents: boolean;
  /** Parâmetros de URL (UTMs). */
  urlTags: string;
  /** "FORM" = formulário instantâneo da Meta; "SITE" = formulário no site com conversão no pixel. */
  conversion: "FORM" | "SITE";
  /** Programação, horário de Brasília ("AAAA-MM-DDTHH:MM"). Vazio = começa ao ativar / sem término. */
  startAt: string;
  endAt: string;
  adsets: PlanAdSet[];
}

export { adSetName } from "@/lib/traffic-naming";
import { adSetName } from "@/lib/traffic-naming";

interface Progress {
  cityKeys?: Record<string, string>;
  instagramUserId?: string | null;
  campaignId?: string;
  adsets?: Record<string, { formId?: string; adSetId?: string; ads?: Record<string, { creativeId?: string; adId?: string }> }>;
  log?: string[];
}

export const DEFAULT_CITIES = ["Americana", "Santa Bárbara d'Oeste", "Paulínia", "Limeira", "Sumaré", "Nova Odessa"];

export function emptyPlan(): TrafficPlan {
  return { name: "Empresários | Região de Americana", conversion: "FORM", budgetMode: "CAMPAIGN", campaignDailyBudget: 30, startAt: "", endAt: "", copy: { primaryTexts: [], headlines: [], descriptions: [] }, splitCopy: false, copyGroups: [], copyByAd: {}, advantageCreative: true, trackSiteEvents: true, trackOfflineEvents: true, urlTags: DEFAULT_URL_TAGS, adsets: [] };
}

/** Normaliza o que vem da tela (nunca confia no formato). */
export function parsePlan(value: unknown): TrafficPlan {
  const v = (value ?? {}) as Partial<TrafficPlan>;
  const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
  const num = (x: unknown, min: number, max: number, fallback: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const adsets = (Array.isArray(v.adsets) ? v.adsets : []).slice(0, 30).map((a, i) => {
    const f = (a?.form ?? {}) as Partial<PlanForm>;
    return {
      key: str(a?.key, 40) || `c${i + 1}`,
      niche: str(a?.niche, 80),
      cities: (Array.isArray(a?.cities) ? a.cities : []).map((c) => str(c, 80)).filter(Boolean).slice(0, 25),
      geoMode: a?.geoMode === "RADIUS" ? ("RADIUS" as const) : ("CITY" as const),
      radiusKm: num(a?.radiusKm, 17, 80, 17),
      temperature: a?.temperature === "QUENTE" ? ("QUENTE" as const) : ("FRIO" as const),
      customAudiences: (Array.isArray(a?.customAudiences) ? a.customAudiences : []).filter((x) => x && typeof x.id === "string").map((x) => ({ id: str(x.id, 40), name: str(x.name, 200) })).slice(0, 20),
      advantage: a?.advantage !== false,
      ageMin: num(a?.ageMin, 18, 65, 25),
      ageMax: num(a?.ageMax, 18, 65, 55),
      gender: (a?.gender === 1 || a?.gender === 2 ? a.gender : 0) as 0 | 1 | 2,
      interests: (Array.isArray(a?.interests) ? a.interests : []).filter((x) => x && typeof x.id === "string").map((x) => ({ id: str(x.id, 40), name: str(x.name, 120) })).slice(0, 25),
      dailyBudget: num(a?.dailyBudget, 0, 100000, 30),
      form: {
        introTitle: str(f.introTitle, 60),
        introBullets: (Array.isArray(f.introBullets) ? f.introBullets : []).map((b) => str(b, 80)).slice(0, 5),
        introText: str(f.introText, 1000),
        contactText: str(f.contactText, 200),
        privacyLinkText: str(f.privacyLinkText, 70),
        askCity: f.askCity === true,
        questions: (Array.isArray(f.questions) ? f.questions : [])
          .map((q) => ({ label: str(q?.label, 200), options: (Array.isArray(q?.options) ? q.options : []).map((o) => str(o, 80)).filter(Boolean).slice(0, 10) }))
          .filter((q) => q.label)
          .slice(0, 8),
        thankTitle: str(f.thankTitle, 60),
        thankBody: str(f.thankBody, 500),
        buttonText: str(f.buttonText, 30),
        buttonUrl: str(f.buttonUrl, 500),
      },
      destinationUrl: str(a?.destinationUrl, 500),
      creativeIds: (Array.isArray(a?.creativeIds) ? a.creativeIds : []).filter((x) => typeof x === "string").slice(0, 20),
    };
  });
  const list = (x: unknown, max: number) => (Array.isArray(x) ? x : []).map((t) => str(t, max)).filter((t) => t.trim()).slice(0, 5);
  const copyOf = (x: unknown): PlanCopy => {
    const c = (x ?? {}) as Partial<PlanCopy>;
    return { primaryTexts: list(c.primaryTexts, 2000), headlines: list(c.headlines, 255), descriptions: list(c.descriptions, 255) };
  };
  const copyGroups = (Array.isArray(v.copyGroups) ? v.copyGroups : []).slice(0, 9).map(copyOf);
  const copyByAd: Record<string, number> = {};
  for (const [k, n] of Object.entries(v.copyByAd && typeof v.copyByAd === "object" ? v.copyByAd : {})) {
    const i = Number(n);
    if (k.length <= 100 && Number.isInteger(i) && i >= 0 && i <= copyGroups.length) copyByAd[k] = i;
  }
  return {
    name: str(v.name, 200) || emptyPlan().name,
    conversion: v.conversion === "SITE" ? "SITE" : "FORM",
    budgetMode: v.budgetMode === "ADSET" ? "ADSET" : "CAMPAIGN",
    startAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v.startAt ?? "")) ? String(v.startAt) : "",
    endAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v.endAt ?? "")) ? String(v.endAt) : "",
    campaignDailyBudget: num(v.campaignDailyBudget, 0, 100000, 30),
    copy: copyOf(v.copy),
    splitCopy: v.splitCopy === true && copyGroups.length > 0,
    copyGroups,
    copyByAd,
    advantageCreative: v.advantageCreative !== false,
    trackSiteEvents: v.trackSiteEvents !== false,
    trackOfflineEvents: v.trackOfflineEvents !== false,
    urlTags: typeof v.urlTags === "string" ? v.urlTags.trim().slice(0, 1000) : DEFAULT_URL_TAGS,
    adsets,
  };
}

/** "AAAA-MM-DDTHH:MM" no horário de Brasília (UTC-3, sem horário de verão) → data. */
export function brasiliaToDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Problemas que impedem subir (mostrados na revisão). */
export async function validatePlan(agencyId: string, plan: TrafficPlan): Promise<string[]> {
  const issues: string[] = [];
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId } });
  if (!settings?.dailyBudgetCapCents) issues.push("Defina o teto de verba diária em Configurações antes de subir.");
  if (settings?.killSwitch) issues.push("O botão de emergência está ligado em Configurações: nada sobe para a Meta.");
  if (!settings?.pageConnectionId) issues.push("Escolha em Configurações a página do Facebook que assina os anúncios.");
  if (plan.conversion === "FORM" && !settings?.privacyPolicyUrl) issues.push("Informe o link da política de privacidade em Configurações (a Meta exige no formulário).");
  if (plan.conversion === "SITE") {
    const ads = await prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } }, select: { metaPixelId: true } });
    if (!ads?.metaPixelId) issues.push("Campanha para o site precisa do Pixel da Meta configurado em Sistema → Integrações.");
  }
  if (!plan.adsets.length) issues.push("Adicione pelo menos um conjunto.");
  const total = planDailyTotal(plan);
  const start = brasiliaToDate(plan.startAt);
  const end = brasiliaToDate(plan.endAt);
  if (end && end.getTime() <= Date.now()) issues.push("A data de término já passou.");
  if (start && end && end.getTime() - start.getTime() < 24 * 60 * 60_000) issues.push("O término precisa ser pelo menos 24 horas depois do início (exigência da Meta).");
  if (plan.budgetMode === "CAMPAIGN" && plan.adsets.length && plan.campaignDailyBudget < 6 * plan.adsets.length) {
    issues.push(`Orçamento da campanha: mínimo de R$ 6/dia por conjunto (R$ ${(6 * plan.adsets.length).toFixed(2)}/dia para ${plan.adsets.length} conjunto(s)).`);
  }
  if (settings?.dailyBudgetCapCents && Math.round(total * 100) > settings.dailyBudgetCapCents) {
    issues.push(`A verba (R$ ${total.toFixed(2)}/dia) passa do teto de R$ ${(settings.dailyBudgetCapCents / 100).toFixed(2)}/dia.`);
  }
  const creativeIds = Array.from(new Set(plan.adsets.flatMap((a) => a.creativeIds)));
  const creatives = await prisma.adCreative.findMany({ where: { agencyId, id: { in: creativeIds } } });
  for (const [index, a] of plan.adsets.entries()) {
    const label = adSetName(a, index);
    if (!a.cities.length) issues.push(`${label}: escolha pelo menos uma cidade.`);
    if (plan.budgetMode === "ADSET" && a.dailyBudget < 6) issues.push(`${label}: verba diária mínima de R$ 6.`);
    if (a.ageMin > a.ageMax) issues.push(`${label}: idade mínima maior que a máxima.`);
    if (a.temperature === "QUENTE" && !a.customAudiences.length) issues.push(`${label}: conjunto [QUENTE] precisa de pelo menos um público personalizado (remarketing).`);
    if (plan.conversion === "FORM") {
      if (!a.form.introTitle || (!a.form.introText && !a.form.introBullets.some((b) => b.trim()))) issues.push(`${label}: preencha o título e a saudação do formulário.`);
      if (!a.form.thankTitle || !a.form.thankBody || !a.form.buttonUrl) issues.push(`${label}: preencha a tela de agradecimento do formulário (título, texto e link do botão).`);
    } else if (!/^https?:\/\//i.test(a.destinationUrl)) issues.push(`${label}: informe o link da página do site (com o formulário).`);
    if (!a.creativeIds.length) issues.push(`${label}: escolha pelo menos um criativo.`);
    const chosen = a.creativeIds.map((id) => creatives.find((x) => x.id === id));
    if (chosen.some((c) => !c)) issues.push(`${label}: um criativo escolhido não existe mais.`);
    for (const [adIndex, g] of adsForAdSet(plan, a.key, chosen.filter((c): c is (typeof creatives)[number] => Boolean(c))).entries()) {
      const pair = [g.feed, g.stories].filter((c): c is NonNullable<typeof c> => Boolean(c));
      const adLabel = `${label} AD${String(adIndex + 1).padStart(2, "0")}`;
      const copy = copyForAd(plan, a.key, (g.feed ?? g.stories)!.id);
      const campaignCopy = copy.primaryTexts.length > 0 && copy.headlines.length > 0;
      if (!campaignCopy && !pair.some((c) => c.primaryText && c.headline)) issues.push(`${adLabel}: preencha o texto principal e o título${plan.splitCopy ? " do grupo de textos escolhido" : ""} ("${pair.map((c) => c.name).join(" + ")}").`);
      for (const c of pair) if (c.missingInDrive && !c.metaImageHash && !c.metaVideoId) issues.push(`${adLabel}: o arquivo "${c.name}" não está mais no Drive.`);
    }
  }
  return Array.from(new Set(issues));
}

async function loadTokens(agencyId: string) {
  const [settings, ads] = await Promise.all([
    prisma.trafficSettings.findUniqueOrThrow({ where: { agencyId } }),
    prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } } }),
  ]);
  if (!ads || ads.status !== "ACTIVE") throw new Error("Conta de anúncios da Meta não conectada.");
  const page = settings.pageConnectionId ? await prisma.socialConnection.findFirst({ where: { id: settings.pageConnectionId, agencyId } }) : null;
  if (!page) throw new Error("Página do Facebook dos anúncios não encontrada. Escolha de novo em Configurações.");
  return { settings, adAccountId: ads.externalAccountId, adsToken: decryptSecret(ads.accessTokenEnc), pageId: page.externalId, pageToken: decryptSecret(page.accessTokenEnc), pixelId: ads.metaPixelId };
}

/**
 * Envia (ou continua enviando) uma campanha. Retomável: grava o que já foi criado em `progress`
 * e, numa nova chamada, pula o que já existe. Para dentro do orçamento de tempo e devolve
 * `done: false` para a tela chamar de novo.
 */
export async function submitTrafficCampaign(campaignId: string, agencyId: string, budgetMs = 45_000): Promise<{ done: boolean; message: string; ok?: boolean }> {
  const started = Date.now();
  const timeLeft = () => budgetMs - (Date.now() - started);
  const row = await prisma.trafficCampaign.findFirstOrThrow({ where: { id: campaignId, agencyId } });
  if (row.status === "SUBMITTED") return { done: true, message: "Campanha já enviada." };
  const plan = parsePlan(row.plan);
  const progress: Progress = (row.progress as Progress | null) ?? {};
  progress.adsets ??= {};
  progress.log ??= [];
  const save = async (data: Partial<{ status: "SUBMITTING" | "SUBMITTED" | "FAILED"; lastError: string | null; metaCampaignId: string; submittedAt: Date }> = {}) =>
    prisma.trafficCampaign.update({ where: { id: row.id }, data: { progress: progress as unknown as Prisma.InputJsonValue, ...data } });

  if (row.status !== "SUBMITTING") {
    const issues = await validatePlan(agencyId, plan);
    if (issues.length) return { done: true, message: issues.join(" ") };
    await save({ status: "SUBMITTING", lastError: null });
  }

  try {
    const { settings, adAccountId, adsToken, pageId, pageToken, pixelId } = await loadTokens(agencyId);
    if (settings.killSwitch) throw new Error("Botão de emergência ligado: envio interrompido.");

    // 1. Cidades → chaves da Meta.
    progress.cityKeys ??= {};
    for (const city of Array.from(new Set(plan.adsets.flatMap((a) => a.cities)))) {
      if (progress.cityKeys[city]) continue;
      const found = await findCityKey(adsToken, city);
      if (!found) throw new Error(`Não encontrei a cidade "${city}" na Meta. Confira o nome.`);
      progress.cityKeys[city] = found.key;
    }
    if (progress.instagramUserId === undefined) progress.instagramUserId = await pageInstagramId(pageToken, pageId);
    await save();

    // 2. Campanha.
    if (!progress.campaignId) {
      // Padrão da Zenite: "[LEAD03] Nome" (código do objetivo + próximo número livre na conta).
      const number = await nextCampaignNumber(adsToken, adAccountId, OBJECTIVE_CODES.OUTCOME_LEADS);
      plan.name = withCampaignCode(OBJECTIVE_CODES.OUTCOME_LEADS, number, plan.name);
      await prisma.trafficCampaign.update({ where: { id: row.id }, data: { name: plan.name, plan: plan as unknown as Prisma.InputJsonValue } });
      progress.campaignId = await createCampaign(adsToken, adAccountId, plan.name, plan.budgetMode === "CAMPAIGN" ? Math.round(plan.campaignDailyBudget * 100) : null);
      progress.log.push(`Campanha criada (${progress.campaignId}).`);
      await save({ metaCampaignId: progress.campaignId });
    }

    const creatives = await prisma.adCreative.findMany({ where: { agencyId, id: { in: plan.adsets.flatMap((a) => a.creativeIds) } } });
    const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    for (const [index, a] of plan.adsets.entries()) {
      const setName = adSetName(a, index);
      const state = (progress.adsets[a.key] ??= { ads: {} });
      state.ads ??= {};
      if (timeLeft() < 8_000) return { done: false, message: `Continuando… (${setName})` };

      // 3. Formulário instantâneo do conjunto.
      if (plan.conversion === "FORM" && !state.formId) {
        state.formId = await createLeadForm(pageToken, pageId, {
          name: `${plan.name} | ${setName} | ${today}`.slice(0, 200),
          introTitle: a.form.introTitle,
          introBullets: a.form.introBullets,
          introText: a.form.introText,
          contactText: a.form.contactText,
          privacyLinkText: a.form.privacyLinkText,
          cityOptions: a.form.askCity ? a.cities : [],
          customQuestions: a.form.questions,
          thankTitle: a.form.thankTitle,
          thankBody: a.form.thankBody,
          buttonText: a.form.buttonText || "Ver site",
          buttonUrl: a.form.buttonUrl,
          privacyUrl: settings.privacyPolicyUrl!,
        });
        progress.log.push(`Formulário de ${setName} criado.`);
        await save();
      }

      // 4. Conjunto.
      if (!state.adSetId) {
        state.adSetId = await createAdSet(adsToken, adAccountId, {
          name: setName,
          campaignId: progress.campaignId,
          pageId,
          dailyBudgetCents: plan.budgetMode === "ADSET" ? Math.round(a.dailyBudget * 100) : null,
          cityKeys: a.cities.map((c) => progress.cityKeys![c]!),
          geoMode: a.geoMode,
          radiusKm: a.radiusKm,
          ageMin: a.ageMin,
          ageMax: a.ageMax,
          gender: a.gender,
          advantage: a.advantage,
          interests: a.interests,
          customAudienceIds: a.temperature === "QUENTE" ? a.customAudiences.map((c) => c.id) : [],
          conversion: plan.conversion,
          pixelId,
          // Início no passado = começa assim que a campanha for ativada.
          startTime: (() => {
            const d = brasiliaToDate(plan.startAt);
            return d && d.getTime() > Date.now() ? d.toISOString() : null;
          })(),
          endTime: brasiliaToDate(plan.endAt)?.toISOString() ?? null,
        });
        progress.log.push(`Conjunto ${setName} criado.`);
        await save();
      }

      // 5. Anúncios: Feed + Stories da mesma imagem viram um anúncio; nome AD01, AD02... no conjunto.
      const groups = adsForAdSet(plan, a.key, a.creativeIds.map((id) => creatives.find((c) => c.id === id)).filter((c): c is (typeof creatives)[number] => Boolean(c)));
      for (const [adIndex, group] of groups.entries()) {
        const adState = (state.ads[group.key] ??= {});
        if (adState.adId) continue;
        if (timeLeft() < 8_000) return { done: false, message: `Continuando… (${setName})` };
        const adName = `AD${String(adIndex + 1).padStart(2, "0")}`;
        const parts = [group.feed, group.stories].filter((c): c is NonNullable<typeof c> => Boolean(c));
        for (const original of parts) {
          let creative = creatives.find((c) => c.id === original.id)!;
          if (!creative.metaImageHash && !creative.metaVideoId) {
            if (creative.status !== "UPLOADING") await setCreativeStatus(creative.id, "UPLOADING");
            try {
              const file = Buffer.from(await (await downloadDriveFile(creative.driveFileId)).arrayBuffer());
              const data =
                creative.kind === "IMAGE"
                  ? { metaImageHash: await uploadAdImage(adsToken, adAccountId, file, creative.fileName) }
                  : { metaVideoId: await uploadAdVideo(adsToken, adAccountId, file, creative.fileName, creative.mimeType) };
              creative = await prisma.adCreative.update({ where: { id: creative.id }, data: { ...data, uploadedAt: new Date(), lastError: null } });
              creatives.splice(creatives.findIndex((c) => c.id === creative.id), 1, creative);
            } catch (error) {
              await setCreativeStatus(creative.id, "FAILED", error instanceof Error ? error.message : "Falha no envio.");
              throw error;
            }
          }
        }
        const feed = group.feed ? creatives.find((c) => c.id === group.feed!.id)! : null;
        const stories = group.stories ? creatives.find((c) => c.id === group.stories!.id)! : null;
        const main = feed ?? stories!;
        const texts = [feed, stories].find((c) => c?.primaryText && c?.headline) ?? main;
        const copy = copyForAd(plan, a.key, main.id);
        const messages = copy.primaryTexts.length ? copy.primaryTexts : [texts.primaryText ?? ""];
        const headlines = copy.headlines.length ? copy.headlines : [texts.headline ?? ""];
        const descriptions = copy.descriptions.length ? copy.descriptions : texts.description ? [texts.description] : [];
        let thumb: string | null = null;
        if (main.metaVideoId) {
          thumb = await videoReadyThumbnail(adsToken, main.metaVideoId);
          if (!thumb) return { done: false, message: `Vídeo "${main.name}" ainda processando na Meta…` };
        }
        if (!adState.creativeId) {
          adState.creativeId = await createAdCreative(adsToken, adAccountId, {
            name: `${setName} | ${adName}`.slice(0, 200),
            pageId,
            instagramUserId: progress.instagramUserId,
            formId: plan.conversion === "FORM" ? state.formId : null,
            linkUrl: plan.conversion === "SITE" ? a.destinationUrl : settings.websiteUrl || a.form.buttonUrl,
            messages,
            headlines,
            descriptions,
            urlTags: plan.urlTags || null,
            advantageCreative: plan.advantageCreative,
            callToAction: texts.callToAction || DEFAULT_CTA,
            imageHash: main.metaImageHash,
            storiesImageHash: feed && stories ? stories.metaImageHash : null,
            videoId: main.metaVideoId,
            videoThumbUrl: thumb,
          });
          await save();
        }
        adState.adId = await createAd(adsToken, adAccountId, adName, state.adSetId, adState.creativeId, {
          pixelId: plan.trackSiteEvents ? pixelId : null,
          datasetId: plan.trackOfflineEvents ? pixelId : null,
        });
        // Padrão de nome no Drive e na biblioteca: "03-01-AD01-F" (campanha-conjunto-anúncio-posicionamento).
        const campaignNo = Number(plan.name.match(/^\[[A-Z]+(\d+)\]/)?.[1] ?? "1");
        for (const [role, c] of [["F", feed], ["S", stories]] as const) {
          if (!c) continue;
          const newName = standardCreativeName(campaignNo, index + 1, adIndex + 1, c.kind === "VIDEO" ? null : role);
          const ext = c.fileName.match(/\.[a-z0-9]{2,4}$/i)?.[0] ?? "";
          await renameDriveFile(c.driveFileId, `${newName}${ext}`).catch((renameError) => console.error("ad_creative_rename_failed", c.id, renameError));
          await prisma.adCreative.update({ where: { id: c.id }, data: { name: newName, fileName: `${newName}${ext}`, primaryText: messages[0] || null, headline: headlines[0] || null, description: descriptions[0] || null, linkUrl: c.linkUrl || (plan.conversion === "SITE" ? a.destinationUrl : settings.websiteUrl || a.form.buttonUrl), metaCreativeId: adState.creativeId, metaAdId: adState.adId } });
          if (c.status === "DRAFT" || c.status === "UPLOADING" || c.status === "FAILED") await setCreativeStatus(c.id, "PAUSED");
        }
        progress.log.push(`Anúncio ${setName} | ${adName} criado${feed && stories ? " (Feed + Stories)" : ""}.`);
        await save();
      }
    }

    await save({ status: "SUBMITTED", submittedAt: new Date(), lastError: null });
    await resolveSystemAlert(agencyId, `ads:campaign:${row.id}`);
    return { done: true, ok: true, message: "Campanha enviada para a Meta: campanha pausada, conjuntos e anúncios ativos. Ative a campanha no Gerenciador quando quiser." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio.";
    await save({ status: "FAILED", lastError: message });
    await raiseSystemAlert({ agencyId, key: `ads:campaign:${row.id}`, category: "INTEGRATION", severity: "WARNING", title: `Campanha não subiu: ${plan.name}`, detail: message, href: "/trafego-raio-x/gestor" });
    return { done: true, message };
  }
}
