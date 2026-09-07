import { Prisma, prisma, type TrackingVisitor, type TrackingSession } from "@zenith/db";
import { normalizeEmail } from "@/lib/leads";
import { fireWorkflowTrigger } from "@/lib/workflow-engine";
import {
  isTrackingEventName,
  isConsentSatisfied,
  normalizeReferrer,
  normalizeTrackingUrl,
  parseConsentSnapshot,
  validateProperties,
  TRACKING_EVENT_CONSENT_REQUIREMENT,
  TRACKING_SESSION_TIMEOUT_MS,
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
  if (!email) return;

  const visitor = await prisma.trackingVisitor.findUnique({ where: { id: visitorId } });
  if (!visitor || visitor.leadId) return;

  const { lead, createdNewLead } = await prisma.$transaction(async (tx) => {
    let lead = await tx.lead.findUnique({ where: { agencyId_email: { agencyId, email } } });
    let createdNewLead = false;
    if (!lead) {
      const name = typeof properties.name === "string" && properties.name.trim() ? properties.name.trim() : email;
      const phone = typeof properties.phone === "string" ? properties.phone : null;
      lead = await tx.lead.create({ data: { agencyId, name, email, phone, source: "tracking" } });
      await tx.leadStatusHistory.create({ data: { leadId: lead.id, toStatus: "NOVO" } });
      createdNewLead = true;
    }
    await tx.trackingVisitor.update({ where: { id: visitorId }, data: { leadId: lead.id } });
    return { lead, createdNewLead };
  });

  if (createdNewLead) {
    await fireWorkflowTrigger(agencyId, "lead.created", "lead", lead.id, {
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      source: lead.source,
    });
  }
}

export async function processTrackingEvent(
  agencyId: string,
  visitorId: string,
  sessionId: string,
  raw: unknown,
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

  try {
    await prisma.trackingEvent.create({
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

  return { eventId, status: "stored" };
}
