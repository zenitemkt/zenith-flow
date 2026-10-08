import { prisma, type CommercialAlertType } from "@zenite-mkt/db";

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

export async function getLeadCommercialSnapshots(agencyId: string, leadIds?: string[]) {
  const leads = await prisma.lead.findMany({
    where: { agencyId, ...(leadIds ? { id: { in: leadIds } } : {}) },
    select: {
      id: true,
      convertedClientId: true,
      trackingVisitors: {
        select: {
          sessions: {
            select: {
              id: true,
              startedAt: true,
              events: { select: { eventName: true, occurredAt: true } },
            },
          },
        },
      },
      opportunities: {
        select: { statusHistory: { select: { toStatus: true, createdAt: true } } },
      },
      proposals: {
        select: { statusHistory: { select: { createdAt: true } } },
      },
    },
  });

  const snapshots = new Map<string, LeadCommercialSnapshot>();
  for (const lead of leads) {
    const sessions = lead.trackingVisitors.flatMap((visitor) => visitor.sessions);
    const events = sessions.flatMap((session) => session.events);
    const count = (eventName: string) => events.filter((event) => event.eventName === eventName).length;
    const latest = (dates: Date[]) => dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const formStartsCount = count("form_start");
    const formSubmitsCount = count("form_submit");
    const serviceViewsCount = count("service_view");
    const whatsappClicksCount = count("whatsapp_click");
    const score = Math.min(
      100,
      Math.min(formSubmitsCount, 1) * 35 +
        Math.min(whatsappClicksCount, 1) * 20 +
        Math.min(formStartsCount, 1) * 10 +
        Math.min(serviceViewsCount, 3) * 8 +
        Math.min(Math.max(sessions.length - 1, 0), 3) * 5,
    );
    snapshots.set(lead.id, {
      leadId: lead.id,
      score,
      temperature: score >= 60 ? "ALTO" : score >= 30 ? "MEDIO" : "BAIXO",
      visitsCount: sessions.length,
      formStartsCount,
      formSubmitsCount,
      serviceViewsCount,
      whatsappClicksCount,
      lastActivityAt: latest(events.map((event) => event.occurredAt)),
      latestSessionAt: latest(sessions.map((session) => session.startedAt)),
      latestFormStartAt: latest(events.filter((event) => event.eventName === "form_start").map((event) => event.occurredAt)),
      latestWonAt: latest(lead.opportunities.flatMap((opportunity) => opportunity.statusHistory).filter((entry) => entry.toStatus === "WON").map((entry) => entry.createdAt)),
      latestProposalAt: latest(lead.proposals.flatMap((proposal) => proposal.statusHistory).map((entry) => entry.createdAt)),
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
