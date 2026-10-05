import { prisma } from "@zenite-mkt/db";

/**
 * "Qualidade do envio" (seção 5 do plano de Traqueamento, Etapa 4,
 * 2026-10-04) — nenhuma tabela nova além do `EventDelivery` que já existia
 * desde a Etapa 2. Match quality e taxa de consentimento vêm de leitura sobre
 * `TrackingEvent`/`TrackingConsent`, que já existiam desde a seção 34/35.
 */

export interface DeliveryCount {
  destination: string;
  status: string;
  count: number;
}

export interface DeliveryQualityStats {
  byDestinationStatus: DeliveryCount[];
  /** % de eventos `identify`/`form_submit` do período com e-mail ou telefone — é o que permite "Advanced Matching" na Meta. */
  matchQuality: { total: number; withIdentifier: number; pct: number };
  /** % de decisões de consentimento no período que liberaram analytics (aceite) vs só essencial (recusa). */
  consentAcceptance: { total: number; accepted: number; pct: number };
}

function hasIdentifier(properties: unknown): boolean {
  if (!properties || typeof properties !== "object") return false;
  const p = properties as Record<string, unknown>;
  return typeof p.email === "string" || typeof p.phone === "string";
}

export async function getDeliveryQualityStats(
  agencyId: string,
  range?: { gte: Date; lt: Date },
): Promise<DeliveryQualityStats> {
  const [deliveryGroups, identifyingEvents, consents] = await Promise.all([
    prisma.eventDelivery.groupBy({
      by: ["destination", "status"],
      where: { agencyId, ...(range ? { attemptedAt: range } : {}) },
      _count: { _all: true },
    }),
    prisma.trackingEvent.findMany({
      where: { agencyId, eventName: { in: ["identify", "form_submit"] }, ...(range ? { occurredAt: range } : {}) },
      select: { properties: true },
    }),
    prisma.trackingConsent.findMany({
      where: { agencyId, ...(range ? { createdAt: range } : {}) },
      select: { categories: true },
    }),
  ]);

  const withIdentifier = identifyingEvents.filter((event) => hasIdentifier(event.properties)).length;
  const accepted = consents.filter((consent) => consent.categories.includes("ANALYTICS")).length;

  return {
    byDestinationStatus: deliveryGroups.map((group) => ({
      destination: group.destination,
      status: group.status,
      count: group._count._all,
    })),
    matchQuality: {
      total: identifyingEvents.length,
      withIdentifier,
      pct: identifyingEvents.length > 0 ? Math.round((withIdentifier / identifyingEvents.length) * 100) : 0,
    },
    consentAcceptance: {
      total: consents.length,
      accepted,
      pct: consents.length > 0 ? Math.round((accepted / consents.length) * 100) : 0,
    },
  };
}
