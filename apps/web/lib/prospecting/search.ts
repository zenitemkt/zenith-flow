import { Prisma, prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { upsertLeadSubmission } from "@/lib/lead-contact";
import { raiseSystemAlert, resolveSystemAlert } from "@/lib/system-alerts";
import { fetchPlaces, getRunState, startPlacesRun, type ApifyRunRef } from "./apify";
import { mergeProspectingConfig } from "./config";
import { prospectEmail, prospectPhone, scoreProspect, type ApifyPlace } from "./scoring";

const ALERT_KEY = "prospecting:search";
/** Combinações segmento × cidade por busca — cada uma é uma execução paga no Apify. */
export const MAX_SEARCH_COMBINATIONS = 12;
/** Execução que passa disso sem terminar é dada como travada. */
const RUN_TIMEOUT_MS = 30 * 60_000;
export const PROSPECTING_LEAD_SOURCE = "Prospecção automática";

function parseRuns(value: unknown): ApifyRunRef[] {
  return Array.isArray(value) ? value.filter((r): r is ApifyRunRef => Boolean(r && typeof r === "object" && typeof (r as ApifyRunRef).runId === "string")) : [];
}

export async function startProspectSearch(agencyId: string): Promise<{ started: number }> {
  const settings = await prisma.prospectingSettings.findUnique({ where: { agencyId } });
  if (!settings?.apifyTokenEnc) throw new Error("Cadastre a chave do Apify antes de buscar.");
  const config = mergeProspectingConfig(settings.config);
  if (!config.segments.length || !config.cities.length) throw new Error("Defina pelo menos um segmento e uma cidade.");
  if (parseRuns(settings.pendingRuns).length) throw new Error("Já existe uma busca em andamento. Aguarde terminar.");

  const combos = config.segments.flatMap((segment) => config.cities.map((city) => ({ segment, city }))).slice(0, MAX_SEARCH_COMBINATIONS);
  const token = decryptSecret(settings.apifyTokenEnc);
  const runs: ApifyRunRef[] = [];
  let error: string | null = null;
  for (const { segment, city } of combos) {
    try {
      runs.push(await startPlacesRun(token, segment, city, config.maxPerSearch));
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha ao iniciar a busca no Apify.";
      break;
    }
  }
  await prisma.prospectingSettings.update({
    where: { agencyId },
    data: { pendingRuns: runs.length ? (runs as unknown as Prisma.InputJsonValue) : Prisma.DbNull, lastSearchError: error },
  });
  if (!runs.length) throw new Error(error ?? "Nenhuma busca iniciada.");
  return { started: runs.length };
}

/** Importa empresas do Google Maps como prospects, pulando repetidas e quem já é Lead da agência. */
export async function importPlaces(agencyId: string, places: ApifyPlace[], segment: string, city: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const place of places) {
    const name = place.title?.trim();
    if (!name || place.permanentlyClosed) {
      skipped++;
      continue;
    }
    const phone = prospectPhone(place);
    const email = prospectEmail(place);
    const keys = [
      place.placeId ? { type: "place", normalizedValue: `place:${place.placeId}` } : null,
      phone ? { type: "phone", normalizedValue: phone } : null,
      email ? { type: "email", normalizedValue: email } : null,
    ].filter((k): k is { type: string; normalizedValue: string } => k !== null);
    if (!keys.length) {
      skipped++;
      continue;
    }

    const [seen, leadPhone, leadEmail] = await Promise.all([
      prisma.prospectContact.findFirst({ where: { agencyId, normalizedValue: { in: keys.map((k) => k.normalizedValue) } }, select: { id: true } }),
      phone ? prisma.leadPhone.findUnique({ where: { agencyId_normalizedValue: { agencyId, normalizedValue: phone } }, select: { id: true } }) : null,
      email ? prisma.leadEmail.findUnique({ where: { agencyId_normalizedValue: { agencyId, normalizedValue: email } }, select: { id: true } }) : null,
    ]);
    if (seen || leadPhone || leadEmail) {
      skipped++;
      continue;
    }

    const { score, temperature, potential } = scoreProspect(place);
    try {
      await prisma.prospect.create({
        data: {
          agencyId,
          name: name.slice(0, 200),
          phone,
          email,
          website: place.website?.slice(0, 300) || null,
          address: place.address?.slice(0, 300) || null,
          segment,
          city,
          category: place.categoryName?.slice(0, 120) || null,
          mapsUrl: place.url?.slice(0, 500) || null,
          rating: place.totalScore ?? null,
          reviewCount: place.reviewsCount ?? null,
          score,
          temperature,
          potential,
          contacts: { create: keys.map((k) => ({ agencyId, ...k })) },
        },
      });
      created++;
    } catch (e) {
      // Duas buscas importando a mesma empresa ao mesmo tempo: a segunda cai aqui.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") skipped++;
      else throw e;
    }
  }
  return { created, skipped };
}

/** Confere as buscas em andamento no Apify e importa as que terminaram. */
export async function checkProspectSearch(agencyId: string): Promise<{ pending: number; created: number; skipped: number; errors: string[] }> {
  const settings = await prisma.prospectingSettings.findUnique({ where: { agencyId } });
  const pending = parseRuns(settings?.pendingRuns);
  if (!settings?.apifyTokenEnc || !pending.length) return { pending: 0, created: 0, skipped: 0, errors: [] };

  const token = decryptSecret(settings.apifyTokenEnc);
  const still: ApifyRunRef[] = [];
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;
  for (const run of pending) {
    const label = `${run.segment} em ${run.city}`;
    try {
      const state = await getRunState(token, run.runId);
      if (state.status === "running") {
        if (Date.now() - new Date(run.startedAt).getTime() > RUN_TIMEOUT_MS) errors.push(`${label}: a busca demorou demais e foi descartada.`);
        else still.push(run);
      } else if (state.status === "failed") {
        errors.push(`${label}: a busca falhou no Apify (${state.reason}).`);
      } else {
        const result = await importPlaces(agencyId, await fetchPlaces(token, state.datasetId), run.segment, run.city);
        created += result.created;
        skipped += result.skipped;
      }
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }

  await prisma.prospectingSettings.update({
    where: { agencyId },
    data: {
      pendingRuns: still.length ? (still as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      ...(still.length ? {} : { lastSearchAt: new Date() }),
      lastSearchError: errors.length ? errors.join(" | ").slice(0, 1000) : null,
    },
  });
  if (errors.length) {
    await raiseSystemAlert({ agencyId, key: ALERT_KEY, category: "AUTOMATION", severity: "WARNING", title: "Prospecção automática: busca com falha", detail: errors.join(" | ").slice(0, 500), href: "/prospeccao" });
  } else if (!still.length) {
    await resolveSystemAlert(agencyId, ALERT_KEY);
  }
  return { pending: still.length, created, skipped, errors };
}

/** Prospect engajou: entra no funil Comercial como Lead (origem "Prospecção automática"). */
export async function convertProspectToLead(agencyId: string, prospectId: string, actorUserId: string | null): Promise<string> {
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, agencyId } });
  if (!prospect) throw new Error("Prospect não encontrado.");
  if (prospect.leadId) return prospect.leadId;
  const { lead } = await prisma.$transaction((tx) =>
    upsertLeadSubmission(tx, {
      agencyId,
      name: prospect.name,
      company: prospect.name,
      phone: prospect.phone,
      email: prospect.email,
      city: prospect.city,
      interest: prospect.segment,
      source: PROSPECTING_LEAD_SOURCE,
      summary: `Prospecção automática: ${prospect.segment} em ${prospect.city}. Nota no Google ${prospect.rating ?? "—"} (${prospect.reviewCount ?? 0} avaliações). ${prospect.potential ?? ""}`.trim(),
      actorUserId,
    }),
  );
  await prisma.prospect.update({ where: { id: prospect.id }, data: { status: "VIROU_LEAD", leadId: lead.id } });
  return lead.id;
}
