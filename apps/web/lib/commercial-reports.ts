import { prisma } from "@zenite-mkt/db";
import { resolveTouchpoint } from "./attribution";

export interface CommercialReportFilters {
  range?: { gte?: Date; lt?: Date };
  origin?: string;
  campaign?: string;
  service?: string;
}

export interface ReportRow {
  label: string;
  visitors: number;
  leads: number;
  qualified: number;
  proposals: number;
  sales: number;
  revenueCents: number;
  abandoned: number;
  conversionRate: number;
}

export interface CommercialReport {
  totals: ReportRow;
  channels: ReportRow[];
  services: ReportRow[];
  firstVsLast: Array<{ first: string; last: string; leads: number; sales: number; revenueCents: number }>;
  timing: { firstContactHours: number | null; qualificationHours: number | null; proposalHours: number | null; saleHours: number | null };
  origins: string[];
  campaigns: string[];
  serviceOptions: string[];
}

function inRange(date: Date, range?: { gte?: Date; lt?: Date }) {
  if (!range) return true;
  return (!range.gte || date >= range.gte) && (!range.lt || date < range.lt);
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function finishRow(row: Omit<ReportRow, "conversionRate">): ReportRow {
  return { ...row, conversionRate: row.leads > 0 ? (row.sales / row.leads) * 100 : 0 };
}

function emptyRow(label: string): Omit<ReportRow, "conversionRate"> {
  return { label, visitors: 0, leads: 0, qualified: 0, proposals: 0, sales: 0, revenueCents: 0, abandoned: 0 };
}

export async function buildCommercialReport(agencyId: string, filters: CommercialReportFilters): Promise<CommercialReport> {
  const [leads, visitors, campaigns] = await Promise.all([
    prisma.lead.findMany({
      where: { agencyId },
      include: {
        submissions: { include: { opportunity: true } },
        statusHistory: true,
        proposals: true,
        opportunities: { include: { statusHistory: true, proposals: true } },
        trackingVisitors: { include: { sessions: { include: { events: true } } } },
      },
    }),
    prisma.trackingVisitor.findMany({
      where: { agencyId },
      include: { sessions: { include: { events: true } } },
    }),
    prisma.campaign.findMany({ where: { agencyId } }),
  ]);

  const channelMap = new Map<string, ReturnType<typeof emptyRow>>();
  const serviceMap = new Map<string, ReturnType<typeof emptyRow>>();
  const journeyMap = new Map<string, { first: string; last: string; leads: Set<string>; sales: number; revenueCents: number }>();
  const originSet = new Set<string>();
  const campaignSet = new Set<string>();
  const serviceSet = new Set<string>();
  const countedChannelVisitors = new Set<string>();
  const totalVisitorIds = new Set<string>();
  const selectedLeadIds = new Set<string>();
  const leadChannel = new Map<string, string>();
  const leadJourney = new Map<string, { first: string; last: string }>();

  for (const lead of leads) {
    const sessions = lead.trackingVisitors.flatMap((visitor) => visitor.sessions).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    const touchpoints = sessions.map((session) => resolveTouchpoint(session, campaigns));
    const first = touchpoints[0]?.channel ?? lead.source ?? "Não identificada";
    const lastNonDirect = [...touchpoints].reverse().find((touchpoint) => !touchpoint.isDirect) ?? touchpoints[touchpoints.length - 1];
    const last = lastNonDirect?.channel ?? lead.source ?? "Não identificada";
    leadChannel.set(lead.id, last);
    leadJourney.set(lead.id, { first, last });
    originSet.add(last);
    for (const session of sessions) if (session.utmCampaign) campaignSet.add(session.utmCampaign);
    for (const submission of lead.submissions) if (submission.service || submission.interest) serviceSet.add(submission.service ?? submission.interest ?? "Não informado");

    const periodSubmissions = lead.submissions.filter((submission) => inRange(submission.createdAt, filters.range));
    const isLeadInPeriod = inRange(lead.createdAt, filters.range) || periodSubmissions.length > 0;
    const campaignMatches = !filters.campaign || sessions.some((session) => session.utmCampaign === filters.campaign);
    const serviceMatches = !filters.service || periodSubmissions.some((submission) => (submission.service ?? submission.interest) === filters.service);
    if (isLeadInPeriod && (!filters.origin || last === filters.origin) && campaignMatches && serviceMatches) selectedLeadIds.add(lead.id);
  }

  for (const visitor of visitors) {
    const periodSessions = visitor.sessions.filter((session) => inRange(session.startedAt, filters.range));
    for (const session of periodSessions) {
      const touchpoint = resolveTouchpoint(session, campaigns);
      if (filters.origin && touchpoint.channel !== filters.origin) continue;
      if (filters.campaign && session.utmCampaign !== filters.campaign) continue;
      if (filters.service && (!visitor.leadId || !selectedLeadIds.has(visitor.leadId))) continue;
      const row = channelMap.get(touchpoint.channel) ?? emptyRow(touchpoint.channel);
      const visitorChannelKey = `${visitor.id}:${touchpoint.channel}`;
      if (!countedChannelVisitors.has(visitorChannelKey)) { row.visitors += 1; countedChannelVisitors.add(visitorChannelKey); }
      totalVisitorIds.add(visitor.id);
      channelMap.set(touchpoint.channel, row);
    }
  }

  const timing = { firstContact: [] as number[], qualification: [] as number[], proposal: [] as number[], sale: [] as number[] };
  for (const lead of leads.filter((item) => selectedLeadIds.has(item.id))) {
    const channel = leadChannel.get(lead.id) ?? "Não identificada";
    const channelRow = channelMap.get(channel) ?? emptyRow(channel);
    channelRow.leads += 1;
    const qualifiedAt = lead.statusHistory.filter((entry) => entry.toStatus === "QUALIFICADO").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt;
    const firstContactAt = lead.statusHistory.filter((entry) => entry.toStatus === "EM_ANDAMENTO").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt;
    const periodProposals = lead.proposals.filter((proposal) => inRange(proposal.createdAt, filters.range));
    const wonEntries = lead.opportunities.flatMap((opportunity) => opportunity.statusHistory.filter((entry) => entry.toStatus === "WON").map((entry) => ({ entry, opportunity }))).filter(({ entry }) => inRange(entry.createdAt, filters.range));
    if (qualifiedAt && inRange(qualifiedAt, filters.range)) channelRow.qualified += 1;
    channelRow.proposals += periodProposals.length;
    channelRow.sales += wonEntries.length;
    channelRow.revenueCents += wonEntries.reduce((sum, item) => sum + (item.opportunity.valueCents ?? 0), 0);
    channelMap.set(channel, channelRow);

    if (firstContactAt && firstContactAt >= lead.createdAt) timing.firstContact.push((firstContactAt.getTime() - lead.createdAt.getTime()) / 3_600_000);
    if (qualifiedAt && qualifiedAt >= lead.createdAt) timing.qualification.push((qualifiedAt.getTime() - lead.createdAt.getTime()) / 3_600_000);
    const firstProposal = lead.proposals.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (firstProposal) timing.proposal.push((firstProposal.createdAt.getTime() - lead.createdAt.getTime()) / 3_600_000);
    const firstWon = wonEntries.sort((a, b) => a.entry.createdAt.getTime() - b.entry.createdAt.getTime())[0];
    if (firstWon) timing.sale.push((firstWon.entry.createdAt.getTime() - lead.createdAt.getTime()) / 3_600_000);

    const journey = leadJourney.get(lead.id)!;
    const journeyKey = `${journey.first} → ${journey.last}`;
    const journeyRow = journeyMap.get(journeyKey) ?? { first: journey.first, last: journey.last, leads: new Set<string>(), sales: 0, revenueCents: 0 };
    journeyRow.leads.add(lead.id);
    journeyRow.sales += wonEntries.length;
    journeyRow.revenueCents += wonEntries.reduce((sum, item) => sum + (item.opportunity.valueCents ?? 0), 0);
    journeyMap.set(journeyKey, journeyRow);

    for (const submission of lead.submissions.filter((item) => inRange(item.createdAt, filters.range))) {
      const service = submission.service ?? submission.interest ?? "Não informado";
      if (filters.service && service !== filters.service) continue;
      const row = serviceMap.get(service) ?? emptyRow(service);
      row.leads += 1;
      const opportunity = submission.opportunity ? lead.opportunities.find((item) => item.id === submission.opportunity?.id) : null;
      if (opportunity) {
        const proposalCount = lead.proposals.filter((proposal) => proposal.opportunityId === opportunity.id && inRange(proposal.createdAt, filters.range)).length;
        const won = opportunity.status === "WON" && opportunity.statusHistory.some((entry) => entry.toStatus === "WON" && inRange(entry.createdAt, filters.range));
        row.proposals += proposalCount;
        if (won) { row.sales += 1; row.revenueCents += opportunity.valueCents ?? 0; }
      }
      serviceMap.set(service, row);
    }
  }

  // Abandono é atribuído ao último serviço visto antes do evento, quando disponível.
  for (const visitor of visitors) for (const session of visitor.sessions) {
    let lastService = "Não identificado";
    for (const event of [...session.events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
      if (event.eventName === "service_view" && event.properties && typeof event.properties === "object" && !Array.isArray(event.properties)) {
        const service = (event.properties as Record<string, unknown>).service;
        if (typeof service === "string") lastService = service;
      }
      if (event.eventName === "form_abandon" && inRange(event.occurredAt, filters.range)) {
        if (filters.service && lastService !== filters.service) continue;
        const row = serviceMap.get(lastService) ?? emptyRow(lastService);
        row.abandoned += 1;
        serviceMap.set(lastService, row);
      }
    }
  }

  const channels = Array.from(channelMap.values()).map(finishRow).sort((a, b) => b.revenueCents - a.revenueCents || b.leads - a.leads);
  const services = Array.from(serviceMap.values()).map(finishRow).sort((a, b) => b.revenueCents - a.revenueCents || b.leads - a.leads);
  const totals = finishRow({
    label: "Total",
    visitors: totalVisitorIds.size,
    leads: selectedLeadIds.size,
    qualified: channels.reduce((sum, row) => sum + row.qualified, 0),
    proposals: channels.reduce((sum, row) => sum + row.proposals, 0),
    sales: channels.reduce((sum, row) => sum + row.sales, 0),
    revenueCents: channels.reduce((sum, row) => sum + row.revenueCents, 0),
    abandoned: services.reduce((sum, row) => sum + row.abandoned, 0),
  });

  return {
    totals,
    channels,
    services,
    firstVsLast: Array.from(journeyMap.values()).map((row) => ({ ...row, leads: row.leads.size })).sort((a, b) => b.revenueCents - a.revenueCents || b.leads - a.leads),
    timing: { firstContactHours: average(timing.firstContact), qualificationHours: average(timing.qualification), proposalHours: average(timing.proposal), saleHours: average(timing.sale) },
    origins: Array.from(originSet).sort(),
    campaigns: Array.from(campaignSet).sort(),
    serviceOptions: Array.from(serviceSet).sort(),
  };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCommercialReportCsv(report: CommercialReport) {
  const header = ["Categoria", "Nome", "Visitantes", "Leads", "Qualificados", "Propostas", "Vendas", "Receita (centavos)", "Abandonos", "Conversão (%)"];
  const values = (category: string, row: ReportRow) => [category, row.label, row.visitors, row.leads, row.qualified, row.proposals, row.sales, row.revenueCents, row.abandoned, row.conversionRate.toFixed(2)];
  const rows = [values("Total", report.totals), ...report.channels.map((row) => values("Canal", row)), ...report.services.map((row) => values("Serviço", row))];
  return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}
