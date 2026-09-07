import { prisma, type Campaign, type TrackingSession } from "@zenith/db";

/**
 * Seção 36 do manual — "Modelos iniciais". `positional` ("posicional
 * futuro") é marcado no próprio manual como `FUTURO` (legenda da página 2:
 * "não bloquear a arquitetura, mas não desenvolver agora") — não implementado
 * nesta fatia, de propósito.
 */
export type AttributionModel = "first_touch" | "last_non_direct" | "linear";

export const ATTRIBUTION_MODELS: AttributionModel[] = ["last_non_direct", "first_touch", "linear"];

export const ATTRIBUTION_MODEL_LABELS: Record<AttributionModel, string> = {
  first_touch: "First touch",
  last_non_direct: "Last non-direct",
  linear: "Linear",
};

export interface Touchpoint {
  sessionId: string;
  occurredAt: Date;
  channel: string;
  campaignId: string | null;
  isDirect: boolean;
}

export interface CreditedTouchpoint extends Touchpoint {
  weight: number;
}

/**
 * Um touchpoint nunca é uma tabela própria — é `TrackingSession` (que já
 * guarda os UTMs) casada com uma `Campaign` por `utm_source`+`utm_campaign`.
 * Sem casamento: `utmSource` sozinho vira o canal ("google", "meta"); com
 * referrer de outra origem vira "Orgânico"; sem nenhum dos dois é "Direto".
 */
export function resolveTouchpoint(session: TrackingSession, campaigns: Campaign[]): Touchpoint {
  const sessionCampaign = session.utmCampaign?.toLowerCase().trim();
  const sessionSource = session.utmSource?.toLowerCase().trim();

  const matched = sessionCampaign
    ? campaigns.find((c) => {
        const campaignUtm = c.utmCampaign?.toLowerCase().trim();
        if (!campaignUtm || campaignUtm !== sessionCampaign) return false;
        const campaignSource = c.utmSource?.toLowerCase().trim();
        return !campaignSource || !sessionSource || campaignSource === sessionSource;
      })
    : undefined;

  if (matched) {
    return { sessionId: session.id, occurredAt: session.startedAt, channel: matched.name, campaignId: matched.id, isDirect: false };
  }
  if (session.utmSource) {
    return { sessionId: session.id, occurredAt: session.startedAt, channel: session.utmSource, campaignId: null, isDirect: false };
  }
  if (session.referrer) {
    let host = session.referrer;
    try {
      host = new URL(session.referrer).hostname;
    } catch {
      // referrer já normalizado no coletor; se ainda assim não parsear, usa o valor bruto
    }
    return { sessionId: session.id, occurredAt: session.startedAt, channel: `Orgânico (${host})`, campaignId: null, isDirect: false };
  }
  return { sessionId: session.id, occurredAt: session.startedAt, channel: "Direto", campaignId: null, isDirect: true };
}

/**
 * "Distribui crédito igualmente entre touchpoints elegíveis" (Linear) e
 * "canal mais recente antes da conversão, ignorando direto quando possível"
 * (Last non-direct) são as regras literais da seção 36.1.
 */
export function applyAttributionModel(touchpoints: Touchpoint[], model: AttributionModel): CreditedTouchpoint[] {
  if (touchpoints.length === 0) return [];

  if (model === "first_touch") {
    return touchpoints.map((tp, i) => ({ ...tp, weight: i === 0 ? 1 : 0 }));
  }

  if (model === "last_non_direct") {
    const nonDirect = touchpoints.map((tp, i) => ({ tp, i })).filter((x) => !x.tp.isDirect);
    const targetIndex = nonDirect.length > 0 ? nonDirect[nonDirect.length - 1]!.i : touchpoints.length - 1;
    return touchpoints.map((tp, i) => ({ ...tp, weight: i === targetIndex ? 1 : 0 }));
  }

  const weight = 1 / touchpoints.length;
  return touchpoints.map((tp) => ({ ...tp, weight }));
}

export async function getLeadJourney(agencyId: string, leadId: string): Promise<Touchpoint[]> {
  const [visitors, campaigns] = await Promise.all([
    prisma.trackingVisitor.findMany({
      where: { agencyId, leadId },
      include: { sessions: { orderBy: { startedAt: "asc" } } },
    }),
    prisma.campaign.findMany({ where: { agencyId } }),
  ]);

  return visitors
    .flatMap((v) => v.sessions)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((session) => resolveTouchpoint(session, campaigns));
}

/** Receita atribuída a um lead = soma de `valueCents` das oportunidades GANHAS ligadas a ele (não a receita do cliente inteiro, pra não misturar serviços sem relação com a aquisição original). */
export async function getWonValueByLead(agencyId: string, leadIds: string[]): Promise<Map<string, number>> {
  if (leadIds.length === 0) return new Map();
  const grouped = await prisma.opportunity.groupBy({
    by: ["leadId"],
    where: { agencyId, status: "WON", leadId: { in: leadIds } },
    _sum: { valueCents: true },
  });
  const map = new Map<string, number>();
  for (const row of grouped) {
    if (row.leadId) map.set(row.leadId, row._sum.valueCents ?? 0);
  }
  return map;
}

export interface LeadAttributionRow {
  leadId: string;
  leadName: string;
  weight: number;
  wonValueCents: number;
}

/**
 * Jornada de todos os leads da agência de uma vez (usado na página da
 * campanha) — uma consulta em lote em vez de N+1 por lead.
 */
export async function computeAgencyLeadJourneys(
  agencyId: string,
): Promise<Map<string, { leadName: string; touchpoints: Touchpoint[] }>> {
  const [visitors, campaigns] = await Promise.all([
    prisma.trackingVisitor.findMany({
      where: { agencyId, leadId: { not: null } },
      include: { sessions: { orderBy: { startedAt: "asc" } }, lead: { select: { id: true, name: true } } },
    }),
    prisma.campaign.findMany({ where: { agencyId } }),
  ]);

  const byLead = new Map<string, { leadName: string; touchpoints: Touchpoint[] }>();
  for (const visitor of visitors) {
    if (!visitor.leadId || !visitor.lead) continue;
    const entry = byLead.get(visitor.leadId) ?? { leadName: visitor.lead.name, touchpoints: [] };
    entry.touchpoints.push(...visitor.sessions.map((session) => resolveTouchpoint(session, campaigns)));
    byLead.set(visitor.leadId, entry);
  }
  for (const entry of byLead.values()) {
    entry.touchpoints.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
  return byLead;
}

/** Leads com crédito (> 0) nesta campanha, sob o modelo escolhido — inclui receita das oportunidades ganhas daquele lead. */
export async function computeCampaignAttribution(
  agencyId: string,
  campaignId: string,
  model: AttributionModel,
): Promise<LeadAttributionRow[]> {
  const journeys = await computeAgencyLeadJourneys(agencyId);
  const rows: { leadId: string; leadName: string; weight: number }[] = [];
  for (const [leadId, { leadName, touchpoints }] of journeys) {
    const credited = applyAttributionModel(touchpoints, model);
    const weight = credited.filter((tp) => tp.campaignId === campaignId).reduce((sum, tp) => sum + tp.weight, 0);
    if (weight > 0) rows.push({ leadId, leadName, weight });
  }

  const wonValueByLead = await getWonValueByLead(
    agencyId,
    rows.map((r) => r.leadId),
  );

  return rows
    .map((r) => ({ ...r, wonValueCents: wonValueByLead.get(r.leadId) ?? 0 }))
    .sort((a, b) => b.weight - a.weight);
}
