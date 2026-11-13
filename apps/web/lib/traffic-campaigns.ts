import { prisma, Prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { downloadDriveFile } from "@/lib/google-drive";
import { setCreativeStatus } from "@/lib/ad-creatives";
import { raiseSystemAlert, resolveSystemAlert } from "@/lib/system-alerts";
import {
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
  introText: string;
  askCity: boolean;
  questions: { label: string; options: string[] }[];
  thankTitle: string;
  thankBody: string;
  buttonText: string;
  buttonUrl: string;
}
export interface PlanAdSet {
  key: string;
  niche: string;
  cities: string[];
  radiusKm: number;
  ageMin: number;
  ageMax: number;
  interests: { id: string; name: string }[];
  dailyBudget: number;
  form: PlanForm;
  creativeIds: string[];
}
export interface TrafficPlan {
  name: string;
  adsets: PlanAdSet[];
}

interface Progress {
  cityKeys?: Record<string, string>;
  instagramUserId?: string | null;
  campaignId?: string;
  adsets?: Record<string, { formId?: string; adSetId?: string; ads?: Record<string, { creativeId?: string; adId?: string }> }>;
  log?: string[];
}

export const DEFAULT_CITIES = ["Americana", "Santa Bárbara d'Oeste", "Paulínia", "Limeira", "Sumaré", "Nova Odessa"];

export function emptyPlan(): TrafficPlan {
  return { name: "Zenite | Cadastros | Nichos locais", adsets: [] };
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
      radiusKm: num(a?.radiusKm, 1, 80, 15),
      ageMin: num(a?.ageMin, 18, 65, 25),
      ageMax: num(a?.ageMax, 18, 65, 60),
      interests: (Array.isArray(a?.interests) ? a.interests : []).filter((x) => x && typeof x.id === "string").map((x) => ({ id: str(x.id, 40), name: str(x.name, 120) })).slice(0, 25),
      dailyBudget: num(a?.dailyBudget, 0, 100000, 30),
      form: {
        introTitle: str(f.introTitle, 60),
        introText: str(f.introText, 1000),
        askCity: f.askCity !== false,
        questions: (Array.isArray(f.questions) ? f.questions : [])
          .map((q) => ({ label: str(q?.label, 200), options: (Array.isArray(q?.options) ? q.options : []).map((o) => str(o, 80)).filter(Boolean).slice(0, 10) }))
          .filter((q) => q.label)
          .slice(0, 8),
        thankTitle: str(f.thankTitle, 60),
        thankBody: str(f.thankBody, 500),
        buttonText: str(f.buttonText, 30),
        buttonUrl: str(f.buttonUrl, 500),
      },
      creativeIds: (Array.isArray(a?.creativeIds) ? a.creativeIds : []).filter((x) => typeof x === "string").slice(0, 20),
    };
  });
  return { name: str(v.name, 200) || emptyPlan().name, adsets };
}

/** Problemas que impedem subir (mostrados na revisão). */
export async function validatePlan(agencyId: string, plan: TrafficPlan): Promise<string[]> {
  const issues: string[] = [];
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId } });
  if (!settings?.dailyBudgetCapCents) issues.push("Defina o teto de verba diária em Configurações antes de subir.");
  if (settings?.killSwitch) issues.push("O botão de emergência está ligado em Configurações: nada sobe para a Meta.");
  if (!settings?.pageConnectionId) issues.push("Escolha em Configurações a página do Facebook que assina os anúncios.");
  if (!settings?.privacyPolicyUrl) issues.push("Informe o link da política de privacidade em Configurações (a Meta exige no formulário).");
  if (!plan.adsets.length) issues.push("Adicione pelo menos um conjunto (nicho).");
  const total = plan.adsets.reduce((sum, a) => sum + a.dailyBudget, 0);
  if (settings?.dailyBudgetCapCents && Math.round(total * 100) > settings.dailyBudgetCapCents) {
    issues.push(`A soma das verbas (R$ ${total.toFixed(2)}/dia) passa do teto de R$ ${(settings.dailyBudgetCapCents / 100).toFixed(2)}/dia.`);
  }
  const creativeIds = Array.from(new Set(plan.adsets.flatMap((a) => a.creativeIds)));
  const creatives = await prisma.adCreative.findMany({ where: { agencyId, id: { in: creativeIds } } });
  for (const a of plan.adsets) {
    const label = a.niche || "Conjunto sem nome";
    if (!a.niche) issues.push("Um conjunto está sem nome de nicho.");
    if (!a.cities.length) issues.push(`${label}: escolha pelo menos uma cidade.`);
    if (a.dailyBudget < 6) issues.push(`${label}: verba diária mínima de R$ 6.`);
    if (a.ageMin > a.ageMax) issues.push(`${label}: idade mínima maior que a máxima.`);
    if (!a.form.introTitle || !a.form.introText) issues.push(`${label}: preencha o título e o texto de abertura do formulário.`);
    if (!a.form.thankTitle || !a.form.thankBody || !a.form.buttonUrl) issues.push(`${label}: preencha a tela de agradecimento do formulário (título, texto e link do botão).`);
    if (!a.creativeIds.length) issues.push(`${label}: escolha pelo menos um criativo.`);
    for (const id of a.creativeIds) {
      const c = creatives.find((x) => x.id === id);
      if (!c) issues.push(`${label}: um criativo escolhido não existe mais.`);
      else if (!c.primaryText || !c.headline) issues.push(`${label}: o criativo "${c.name}" está sem texto principal ou título.`);
      else if (c.missingInDrive && !c.metaImageHash && !c.metaVideoId) issues.push(`${label}: o arquivo do criativo "${c.name}" não está mais no Drive.`);
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
  return { settings, adAccountId: ads.externalAccountId, adsToken: decryptSecret(ads.accessTokenEnc), pageId: page.externalId, pageToken: decryptSecret(page.accessTokenEnc) };
}

/**
 * Envia (ou continua enviando) uma campanha. Retomável: grava o que já foi criado em `progress`
 * e, numa nova chamada, pula o que já existe. Para dentro do orçamento de tempo e devolve
 * `done: false` para a tela chamar de novo.
 */
export async function submitTrafficCampaign(campaignId: string, agencyId: string, budgetMs = 45_000): Promise<{ done: boolean; message: string }> {
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
    const { settings, adAccountId, adsToken, pageId, pageToken } = await loadTokens(agencyId);
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
      progress.campaignId = await createCampaign(adsToken, adAccountId, plan.name);
      progress.log.push(`Campanha criada (${progress.campaignId}).`);
      await save({ metaCampaignId: progress.campaignId });
    }

    const creatives = await prisma.adCreative.findMany({ where: { agencyId, id: { in: plan.adsets.flatMap((a) => a.creativeIds) } } });
    const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    for (const a of plan.adsets) {
      const state = (progress.adsets[a.key] ??= { ads: {} });
      state.ads ??= {};
      if (timeLeft() < 8_000) return { done: false, message: `Continuando… (${a.niche})` };

      // 3. Formulário instantâneo do conjunto.
      if (!state.formId) {
        state.formId = await createLeadForm(pageToken, pageId, {
          name: `${plan.name} | ${a.niche} | ${today}`,
          introTitle: a.form.introTitle,
          introText: a.form.introText,
          cityOptions: a.form.askCity ? a.cities : [],
          customQuestions: a.form.questions,
          thankTitle: a.form.thankTitle,
          thankBody: a.form.thankBody,
          buttonText: a.form.buttonText || "Ver site",
          buttonUrl: a.form.buttonUrl,
          privacyUrl: settings.privacyPolicyUrl!,
        });
        progress.log.push(`Formulário de ${a.niche} criado.`);
        await save();
      }

      // 4. Conjunto.
      if (!state.adSetId) {
        state.adSetId = await createAdSet(adsToken, adAccountId, {
          name: `${a.niche} | ${a.cities.join(", ")}`.slice(0, 200),
          campaignId: progress.campaignId,
          pageId,
          dailyBudgetCents: Math.round(a.dailyBudget * 100),
          cityKeys: a.cities.map((c) => progress.cityKeys![c]!),
          radiusKm: a.radiusKm,
          ageMin: a.ageMin,
          ageMax: a.ageMax,
          interests: a.interests,
        });
        progress.log.push(`Conjunto ${a.niche} criado.`);
        await save();
      }

      // 5. Anúncios (sobe o arquivo do criativo uma vez só e reaproveita).
      for (const creativeId of a.creativeIds) {
        const adState = (state.ads[creativeId] ??= {});
        if (adState.adId) continue;
        if (timeLeft() < 8_000) return { done: false, message: `Continuando… (${a.niche})` };
        let creative = creatives.find((c) => c.id === creativeId)!;
        if (!creative.metaImageHash && !creative.metaVideoId) {
          if (creative.status !== "UPLOADING") await setCreativeStatus(creative.id, "UPLOADING");
          try {
            const file = Buffer.from(await (await downloadDriveFile(creative.driveFileId)).arrayBuffer());
            const data =
              creative.kind === "IMAGE"
                ? { metaImageHash: await uploadAdImage(adsToken, adAccountId, file, creative.fileName) }
                : { metaVideoId: await uploadAdVideo(adsToken, adAccountId, file, creative.fileName, creative.mimeType) };
            creative = await prisma.adCreative.update({ where: { id: creative.id }, data: { ...data, uploadedAt: new Date(), lastError: null } });
          } catch (error) {
            await setCreativeStatus(creative.id, "FAILED", error instanceof Error ? error.message : "Falha no envio.");
            throw error;
          }
        }
        let thumb: string | null = null;
        if (creative.metaVideoId) {
          thumb = await videoReadyThumbnail(adsToken, creative.metaVideoId);
          if (!thumb) return { done: false, message: `Vídeo "${creative.name}" ainda processando na Meta…` };
        }
        if (!adState.creativeId) {
          adState.creativeId = await createAdCreative(adsToken, adAccountId, {
            name: `${a.niche} | ${creative.name}`,
            pageId,
            instagramUserId: progress.instagramUserId,
            formId: state.formId,
            linkUrl: settings.websiteUrl || a.form.buttonUrl,
            message: creative.primaryText!,
            headline: creative.headline!,
            description: creative.description,
            callToAction: creative.callToAction || "SIGN_UP",
            imageHash: creative.metaImageHash,
            videoId: creative.metaVideoId,
            videoThumbUrl: thumb,
          });
          await save();
        }
        adState.adId = await createAd(adsToken, adAccountId, `${a.niche} | ${creative.name}`, state.adSetId, adState.creativeId);
        await prisma.adCreative.update({ where: { id: creative.id }, data: { metaCreativeId: adState.creativeId, metaAdId: adState.adId } });
        if (creative.status === "DRAFT" || creative.status === "UPLOADING" || creative.status === "FAILED") await setCreativeStatus(creative.id, "PAUSED");
        progress.log.push(`Anúncio ${a.niche} | ${creative.name} criado.`);
        await save();
      }
    }

    await save({ status: "SUBMITTED", submittedAt: new Date(), lastError: null });
    await resolveSystemAlert(agencyId, `ads:campaign:${row.id}`);
    return { done: true, message: "Campanha enviada para a Meta, pausada. Ative no Gerenciador ou aqui quando quiser." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio.";
    await save({ status: "FAILED", lastError: message });
    await raiseSystemAlert({ agencyId, key: `ads:campaign:${row.id}`, category: "INTEGRATION", severity: "WARNING", title: `Campanha não subiu: ${plan.name}`, detail: message, href: "/automacoes/trafego" });
    return { done: true, message };
  }
}
