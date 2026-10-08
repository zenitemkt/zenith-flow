import { Prisma, prisma, type TrackingVisitor, type TrackingSession } from "@zenite-mkt/db";
import { normalizeEmail } from "@/lib/leads";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import { upsertLeadSubmission } from "@/lib/lead-contact";
import { decryptSecret } from "@/lib/crypto-secrets";
import { sendMetaCapiEvent, META_EVENT_NAME_MAP } from "@/lib/meta-capi";
import {
  isTrackingEventName,
  isConsentSatisfied,
  normalizeReferrer,
  normalizeTrackingUrl,
  parseConsentSnapshot,
  validateProperties,
  TRACKING_EVENT_CONSENT_REQUIREMENT,
  TRACKING_SESSION_TIMEOUT_MS,
  type ConsentSnapshot,
  type TrackingEventName,
} from "@/lib/tracking";

export interface EventResult {
  eventId: string | null;
  status: "stored" | "duplicate" | "dropped_no_consent" | "invalid";
  error?: string;
}

export async function resolveVisitor(agencyId: string, visitorId: unknown): Promise<TrackingVisitor> {
  if (typeof visitorId === "string" && visitorId) {
    const existing = await prisma.trackingVisitor.findUnique({ where: { id: visitorId } });
    if (existing && existing.agencyId === agencyId) return existing;
  }
  return prisma.trackingVisitor.create({ data: { agencyId } });
}

interface SessionSeed {
  landingUrl: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  deviceType: string | null;
  browser: string | null;
}

export async function resolveSession(
  visitorId: string,
  sessionId: unknown,
  seed: SessionSeed,
): Promise<TrackingSession> {
  if (typeof sessionId === "string" && sessionId) {
    const existing = await prisma.trackingSession.findUnique({ where: { id: sessionId } });
    if (existing && existing.visitorId === visitorId) {
      const expired = Date.now() - existing.lastEventAt.getTime() > TRACKING_SESSION_TIMEOUT_MS;
      if (!expired) return existing;
    }
  }
  return prisma.trackingSession.create({ data: { visitorId, ...seed } });
}

/**
 * Seção 34.2: e-mail normalizado identifica um Lead — não sobrescreve uma
 * identidade já resolvida (evita "fundir por semelhança" pisando num vínculo
 * anterior legítimo). Cria o Lead se ainda não existir, mesma função de
 * dedupe por e-mail já usada em `/api/leads`.
 */
async function identifyVisitor(
  agencyId: string,
  visitorId: string,
  properties: Record<string, string | number | boolean | null>,
): Promise<void> {
  const email = typeof properties.email === "string" ? normalizeEmail(properties.email) : null;
  const phone = typeof properties.phone === "string" ? properties.phone : null;
  if (!email && !phone) return;

  const visitor = await prisma.trackingVisitor.findUnique({ where: { id: visitorId } });
  if (!visitor || visitor.leadId) return;

  const result = await prisma.$transaction(async (tx) => {
    const contact = await upsertLeadSubmission(tx, {
      agencyId,
      name: typeof properties.name === "string" && properties.name.trim() ? properties.name.trim() : email ?? phone!,
      email,
      phone,
      source: "tracking",
      createOpportunity: "new-only",
    });
    await tx.trackingVisitor.update({ where: { id: visitorId }, data: { leadId: contact.lead.id } });
    return contact;
  });

  if (result.createdNewLead) {
    await fireWorkflowTrigger(agencyId, "lead.created", "lead", result.lead.id, {
      leadId: result.lead.id,
      name: result.lead.name,
      email: result.lead.email,
      source: result.lead.source,
    });
  }
}

/**
 * Meta Conversions API (seção 38.1, Etapa 2 do plano de Traqueamento) — manda
 * o evento recém-gravado pra Meta, sob o mesmo `eventId` que o Pixel do
 * navegador usa, pra deduplicar. Silencioso quando a agência não conectou a
 * Meta ou não configurou um Pixel ID ainda (nada a mandar). Sempre grava o
 * resultado em `EventDelivery` (mesmo quando falha) — é a base da seção 5
 * "Qualidade do envio". Nunca lança: uma falha na Meta não pode derrubar o
 * coletor nem aparecer como erro pro visitante do site.
 */
async function dispatchMetaCapiEvent(
  agencyId: string,
  trackingEventId: string,
  eventName: string,
  eventId: string,
  occurredAt: Date,
  url: string | null,
  properties: Record<string, string | number | boolean | null>,
  clientIp: string | null,
  clientUserAgent: string | null,
  consent: ConsentSnapshot,
): Promise<void> {
  const metaEventName = META_EVENT_NAME_MAP[eventName];
  if (!metaEventName || !consent.marketing) return;

  const connection = await prisma.adAccountConnection.findUnique({
    where: { agencyId_platform: { agencyId, platform: "META" } },
  });
  if (!connection || !connection.metaPixelId || connection.status !== "ACTIVE") return;

  let status: "SENT" | "FAILED" = "SENT";
  let error: string | null = null;
  try {
    const accessToken = decryptSecret(connection.accessTokenEnc);
    await sendMetaCapiEvent(connection.metaPixelId, accessToken, {
      eventName: metaEventName,
      eventId,
      occurredAt,
      url,
      email: typeof properties.email === "string" ? properties.email : null,
      phone: typeof properties.phone === "string" ? properties.phone : null,
      clientIp,
      clientUserAgent,
      // Só pra verificação manual no Gerenciador de Eventos — var só deve existir na Vercel durante o teste, nunca em uso real.
      testEventCode: process.env.META_CAPI_TEST_EVENT_CODE || null,
    });
  } catch (err) {
    status = "FAILED";
    error = err instanceof Error ? err.message : "Erro desconhecido.";
  }

  await prisma.eventDelivery
    .create({ data: { agencyId, trackingEventId, destination: "META", status, error } })
    .catch(() => {
      /* Falha ao gravar o log de auditoria não pode mascarar nem agravar o problema original. */
    });
}
export async function processTrackingEvent(
  agencyId: string,
  visitorId: string,
  sessionId: string,
  raw: unknown,
  requestContext: { clientIp: string | null; clientUserAgent: string | null },
): Promise<EventResult> {
  const body = raw as Record<string, unknown> | null;
  const eventId = typeof body?.eventId === "string" && body.eventId ? body.eventId : null;
  if (!eventId) return { eventId: null, status: "invalid", error: "eventId ausente." };
  if (!isTrackingEventName(body?.eventName)) {
    return { eventId, status: "invalid", error: "eventName desconhecido." };
  }
  const eventName = body!.eventName as TrackingEventName;

  const occurredAtRaw = typeof body?.occurredAt === "string" ? new Date(body.occurredAt) : null;
  if (!occurredAtRaw || Number.isNaN(occurredAtRaw.getTime())) {
    return { eventId, status: "invalid", error: "occurredAt inválido." };
  }

  const consent = parseConsentSnapshot(body?.consent);
  if (!consent) return { eventId, status: "invalid", error: "consent inválido." };

  const properties = validateProperties(body?.properties);
  if (properties === null) return { eventId, status: "invalid", error: "properties inválido." };

  const requirement = TRACKING_EVENT_CONSENT_REQUIREMENT[eventName];
  if (!isConsentSatisfied(consent, requirement)) {
    return { eventId, status: "dropped_no_consent" };
  }

  const normalizedUrl = normalizeTrackingUrl(body?.url);
  const referrer = normalizeReferrer(body?.referrer);

  let created: { id: string };
  try {
    created = await prisma.trackingEvent.create({
      data: {
        agencyId,
        visitorId,
        sessionId,
        eventName,
        eventId,
        url: normalizedUrl.url,
        referrer,
        utmSource: normalizedUrl.utmSource,
        utmMedium: normalizedUrl.utmMedium,
        utmCampaign: normalizedUrl.utmCampaign,
        utmContent: normalizedUrl.utmContent,
        utmTerm: normalizedUrl.utmTerm,
        properties,
        consent: consent as unknown as Prisma.InputJsonValue,
        occurredAt: occurredAtRaw,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { eventId, status: "duplicate" };
    }
    throw error;
  }

  if (eventName === "identify") {
    await identifyVisitor(agencyId, visitorId, properties);
  }

  await dispatchMetaCapiEvent(
    agencyId,
    created.id,
    eventName,
    eventId,
    occurredAtRaw,
    normalizedUrl.url,
    properties,
    requestContext.clientIp,
    requestContext.clientUserAgent,
    consent,
  );

  return { eventId, status: "stored" };
}
