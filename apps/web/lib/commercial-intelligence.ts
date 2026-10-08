import { prisma, type CommercialAlertType } from "@zenite-mkt/db";
import { computeEngagementScore } from "./lead-intelligence";

export interface LeadCommercialSnapshot {
  leadId: string;
  score: number;
  temperature: "BAIXO" | "MEDIO" | "ALTO";
  visitsCount: number;
  formStartsCount: number;
  formSubmitsCount: number;
  serviceViewsCount: number;
  whatsappClicksCount: number;
  lastActivityAt: Date | null;
  latestSessionAt: Date | null;
  latestFormStartAt: Date | null;
  latestWonAt: Date | null;
  latestProposalAt: Date | null;
  isClient: boolean;
}

function latestOf(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function latestFrom(dates: Date[]): Date | null {
  return dates.reduce<Date | null>((max, date) => latestOf(max, date), null);
}

interface LeadAggregate {
  visitsCount: number;
  latestSessionAt: Date | null;
  formStartsCount: number;
  formSubmitsCount: number;
  serviceViewsCount: number;
  whatsappClicksCount: number;
  lastActivityAt: Date | null;
  latestFormStartAt: Date | null;
}

function emptyAggregate(): LeadAggregate {
  return {
    visitsCount: 0,
    latestSessionAt: null,
    formStartsCount: 0,
    formSubmitsCount: 0,
    serviceViewsCount: 0,
    whatsappClicksCount: 0,
    lastActivityAt: null,
    latestFormStartAt: null,
  };
}

/**
 * Agrega sessões/eventos de tracking direto no banco (groupBy por
 * visitorId/eventName) em vez de carregar o evento bruto de cada visita de
 * cada lead pra memória — a versão anterior buscava `trackingVisitors ->
 * sessions -> events` aninhado, o que cresce sem limite com o histórico da
 * agência. Aqui só o necessário pro score/alertas trafega do Postgres.
 */
export async function getLeadCommercialSnapshots(agencyId: string, leadIds?: string[]) {
  const leads = await prisma.lead.findMany({
    where: { agencyId, ...(leadIds ? { id: { in: leadIds } } : {}) },
    select: {
      id: true,
      convertedClientId: true,
      opportunities: { select: { statusHistory: { select: { toStatus: true, createdAt: true } } } },
      proposals: { select: { statusHistory: { select: { createdAt: true } } } },
    },
  });
  const snapshots = new Map<string, LeadCommercialSnapshot>();
  if (leads.length === 0) return snapshots;

  const leadIdList = leads.map((lead) => lead.id);
  const visitors = await prisma.trackingVisitor.findMany({
    where: { agencyId, leadId: { in: leadIdList } },
    select: { id: true, leadId: true },
  });
  const visitorToLead = new Map(visitors.map((visitor) => [visitor.id, visitor.leadId as string]));
  const visitorIds = visitors.map((visitor) => visitor.id);

  const [sessionGroups, eventGroups] = await Promise.all([
    prisma.trackingSession.groupBy({
      by: ["visitorId"],
      where: { visitorId: { in: visitorIds } },
      _count: { _all: true },
      _max: { startedAt: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ["visitorId", "eventName"],
      where: { agencyId, visitorId: { in: visitorIds } },
      _count: { _all: true },
      _max: { occurredAt: true },
    }),
  ]);

  const aggregates = new Map<string, LeadAggregate>();
  const aggregateFor = (leadId: string) => {
    const existing = aggregates.get(leadId);
    if (existing) return existing;
    const created = emptyAggregate();
    aggregates.set(leadId, created);
    return created;
  };

  for (const group of sessionGroups) {
    const leadId = visitorToLead.get(group.visitorId);
    if (!leadId) continue;
    const agg = aggregateFor(leadId);
    agg.visitsCount += group._count._all;
    agg.latestSessionAt = latestOf(agg.latestSessionAt, group._max.startedAt);
  }
  for (const group of eventGroups) {
    const leadId = visitorToLead.get(group.visitorId);
    if (!leadId) continue;
    const agg = aggregateFor(leadId);
    agg.lastActivityAt = latestOf(agg.lastActivityAt, group._max.occurredAt);
    if (group.eventName === "form_start") {
      agg.formStartsCount += group._count._all;
      agg.latestFormStartAt = latestOf(agg.latestFormStartAt, group._max.occurredAt);
    } else if (group.eventName === "form_submit") {
      agg.formSubmitsCount += group._count._all;
    } else if (group.eventName === "service_view") {
      agg.serviceViewsCount += group._count._all;
    } else if (group.eventName === "whatsapp_click") {
      agg.whatsappClicksCount += group._count._all;
    }
  }

  for (const lead of leads) {
    const agg = aggregates.get(lead.id) ?? emptyAggregate();
    const { score, temperature } = computeEngagementScore(agg);
    snapshots.set(lead.id, {
      leadId: lead.id,
      score,
      temperature,
      visitsCount: agg.visitsCount,
      formStartsCount: agg.formStartsCount,
      formSubmitsCount: agg.formSubmitsCount,
      serviceViewsCount: agg.serviceViewsCount,
      whatsappClicksCount: agg.whatsappClicksCount,
      lastActivityAt: agg.lastActivityAt,
      latestSessionAt: agg.latestSessionAt,
      latestFormStartAt: agg.latestFormStartAt,
      latestWonAt: latestFrom(lead.opportunities.flatMap((opportunity) => opportunity.statusHistory).filter((entry) => entry.toStatus === "WON").map((entry) => entry.createdAt)),
      latestProposalAt: latestFrom(lead.proposals.flatMap((proposal) => proposal.statusHistory).map((entry) => entry.createdAt)),
      isClient: Boolean(lead.convertedClientId),
    });
  }
  return snapshots;
}

interface AlertCandidate {
  type: CommercialAlertType;
  at: Date;
  title: string;
  detail: string;
  score?: number;
}

export async function syncCommercialAlerts(agencyId: string) {
  const snapshots = await getLeadCommercialSnapshots(agencyId);
  const operations = [];
  for (const snapshot of snapshots.values()) {
    const candidates: AlertCandidate[] = [];
    if (snapshot.temperature === "ALTO" && snapshot.lastActivityAt) {
      candidates.push({ type: "HOT_LEAD", at: snapshot.lastActivityAt, title: "Lead quente precisa de atenção", detail: `Pontuação de interesse em ${snapshot.score}/100.`, score: snapshot.score });
    }
    if (snapshot.visitsCount > 1 && snapshot.latestSessionAt) {
      candidates.push({ type: "RETURNING_LEAD", at: snapshot.latestSessionAt, title: "Lead retornou ao site", detail: `${snapshot.visitsCount} visitas identificadas.` });
    }
    if (snapshot.formStartsCount > snapshot.formSubmitsCount && snapshot.latestFormStartAt) {
      candidates.push({ type: "FORM_ABANDONED", at: snapshot.latestFormStartAt, title: "Formulário não concluído", detail: "O lead começou a preencher o orçamento, mas não enviou." });
    }
    if (snapshot.isClient && snapshot.lastActivityAt && (!snapshot.latestWonAt || snapshot.lastActivityAt > snapshot.latestWonAt)) {
      candidates.push({ type: "CLIENT_RETURNED", at: snapshot.lastActivityAt, title: "Cliente demonstrou novo interesse", detail: "Atividade no site detectada depois da última negociação ganha." });
    }
    if (snapshot.latestProposalAt && snapshot.lastActivityAt && snapshot.lastActivityAt > snapshot.latestProposalAt) {
      candidates.push({ type: "RETURNED_AFTER_PROPOSAL", at: snapshot.lastActivityAt, title: "Lead voltou após a proposta", detail: "Nova atividade detectada depois da movimentação da proposta." });
    }

    for (const candidate of candidates) {
      const eventKey = `${candidate.type}:${snapshot.leadId}:${candidate.at.toISOString()}`;
      operations.push(prisma.commercialAlert.upsert({
        where: { agencyId_eventKey: { agencyId, eventKey } },
        update: { title: candidate.title, detail: candidate.detail, score: candidate.score },
        create: { agencyId, leadId: snapshot.leadId, eventKey, type: candidate.type, title: candidate.title, detail: candidate.detail, score: candidate.score, detectedAt: candidate.at },
      }));
    }
  }
  if (operations.length > 0) await prisma.$transaction(operations);
  return snapshots;
}
