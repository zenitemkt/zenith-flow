import { prisma } from "@zenite-mkt/db";
import { bandForScore, HEALTH_BAND_LABELS, type HealthBand } from "./health-score";
import { CHURN_BAND_LABELS, type ChurnBand } from "./churn-risk";
import { CLIENT_STATUS_LABELS } from "./clients";
import { LEAD_STATUS_LABELS } from "./leads";
import { PROPOSAL_STATUS_LABELS } from "./proposals";
import { CONTENT_STATUS_LABELS } from "./content";
import { WORK_ITEM_STATUS_LABELS } from "./tasks";
import { collectionStageForDueDate, COLLECTION_STAGE_LABELS, type CollectionStage } from "./collection-ladder";
import { computeDSO, computeLogoChurnRate, INDICATOR_WINDOW_DAYS } from "./finance-indicators";
import { statusAsOf } from "./cohort";
import { startOfWeekUTC } from "./timesheets";
import { getAgencyMembers } from "./team";
import type { ClientStatus, ProposalStatus, ContentStatus, WorkItemStatus, EmployeeStatus } from "@zenite-mkt/db";

/**
 * X-RAY da agência (Home): consolida, por tema, os indicadores que o dono
 * precisa ver de cara. Nenhum cálculo novo de regra de negócio aqui — tudo
 * reaproveita a mesma fonte/fórmula já usada nas telas de detalhe de cada
 * módulo (Health Score, Risco de churn, DSO/Logo churn, régua de cobrança
 * etc.); esta função só agrega pra visualização em gráfico.
 */

export const CHART_PALETTE = [
  "#FF2B00",
  "#16A36A",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#A855F7",
  "#14B8A6",
  "#F97316",
  "#64748B",
];

const MONTH_LABELS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function colorFor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]!;
}

const HEALTH_BAND_COLORS: Record<HealthBand, string> = {
  EXCELENTE: "#16A36A",
  SAUDAVEL: "#3B82F6",
  ATENCAO: "#F59E0B",
  ALTO_RISCO: "#EF4444",
};

const CHURN_BAND_COLORS: Record<ChurnBand, string> = {
  BAIXO: "#16A36A",
  MEDIO: "#F59E0B",
  ALTO: "#EF4444",
};

const COLLECTION_STAGE_COLORS: Record<CollectionStage, string> = {
  LEMBRETE: "#64748B",
  VENCIMENTO: "#3B82F6",
  ATRASO_1: "#F59E0B",
  ATRASO_3: "#F97316",
  ESCALONAR: "#EF4444",
  RECUPERACAO: "#B91C1C",
};

export interface NamedCount {
  name: string;
  value: number;
  color: string;
}

export async function getXrayDashboard(agencyId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const indicatorPeriodStart = new Date(now.getTime() - INDICATOR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const weekStart = startOfWeekUTC(now);

  const [
    clientsByStatus,
    latestHealthSnapshots,
    latestChurnSnapshots,
    latestNps,
    latestEnps,
    pipelineStages,
    openOpportunities,
    opportunitiesByStatus,
    proposalsByStatus,
    leads,
    openTasks,
    expenseEntries,
    revenueEntriesForCashflow,
    receivablesOpen,
    arAggregate,
    creditSalesAggregate,
    clientsForIndicators,
    employeesByStatus,
    weekTimeEntries,
    agencyMembers,
    contentByStatus,
  ] = await Promise.all([
    prisma.client.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
    prisma.healthScoreSnapshot.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, score: true },
    }),
    prisma.churnRiskSnapshot.findMany({
      where: { agencyId },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, band: true },
    }),
    prisma.npsSnapshot.findFirst({
      where: { agencyId },
      orderBy: { computedAt: "desc" },
      include: { campaign: { select: { name: true } } },
    }),
    prisma.enpsSnapshot.findFirst({
      where: { agencyId },
      orderBy: { computedAt: "desc" },
      include: { campaign: { select: { name: true } } },
    }),
    prisma.pipelineStage.findMany({ where: { agencyId }, orderBy: { order: "asc" } }),
    prisma.opportunity.findMany({
      where: { agencyId, status: "OPEN" },
      select: { stageId: true, valueCents: true },
    }),
    prisma.opportunity.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
    prisma.proposal.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
    prisma.lead.findMany({ where: { agencyId }, select: { status: true, createdAt: true } }),
    prisma.task.findMany({
      where: { project: { agencyId }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
      select: { status: true, assigneeUserId: true },
    }),
    prisma.financeEntry.findMany({
      where: { agencyId, type: "DESPESA", status: "LIQUIDADO", settledDate: { gte: monthStart, lt: monthEnd } },
      select: { amountCents: true, category: { select: { name: true } } },
    }),
    prisma.financeEntry.findMany({
      where: {
        agencyId,
        type: "RECEITA",
        OR: [
          { competencyDate: { gte: sixMonthsAgo, lt: monthEnd } },
          { settledDate: { gte: sixMonthsAgo, lt: monthEnd } },
        ],
      },
      select: { status: true, amountCents: true, competencyDate: true, settledDate: true },
    }),
    prisma.financeEntry.findMany({
      where: { agencyId, type: "RECEITA", status: { in: ["PENDENTE", "VENCIDO"] } },
      select: { dueDate: true, amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: { agencyId, type: "RECEITA", status: { in: ["PENDENTE", "VENCIDO"] } },
      _sum: { amountCents: true },
    }),
    prisma.financeEntry.aggregate({
      where: {
        agencyId,
        type: "RECEITA",
        status: { not: "CANCELADO" },
        competencyDate: { gte: indicatorPeriodStart, lte: now },
      },
      _sum: { amountCents: true },
    }),
    prisma.client.findMany({
      where: { agencyId },
      select: { statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.employee.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
    prisma.timeEntry.findMany({
      where: { agencyId, date: { gte: weekStart } },
      select: { userId: true, minutes: true },
    }),
    getAgencyMembers(agencyId),
    prisma.contentItem.groupBy({ by: ["status"], where: { agencyId, status: { not: "ARQUIVADO" } }, _count: true }),
  ]);

  const memberNameById = new Map(agencyMembers.map((m) => [m.userId, m.name]));

  // --- Clientes & Saúde ---------------------------------------------------
  const clientStatusData: NamedCount[] = clientsByStatus
    .filter((c) => c._count > 0)
    .map((c, i) => ({ name: CLIENT_STATUS_LABELS[c.status as ClientStatus], value: c._count, color: colorFor(i) }));

  const latestScoreByClient = new Map<string, number>();
  for (const s of latestHealthSnapshots) {
    if (!latestScoreByClient.has(s.clientId)) latestScoreByClient.set(s.clientId, s.score);
  }
  const healthBandCounts: Record<HealthBand, number> = { EXCELENTE: 0, SAUDAVEL: 0, ATENCAO: 0, ALTO_RISCO: 0 };
  for (const score of latestScoreByClient.values()) {
    healthBandCounts[bandForScore(score)] += 1;
  }
  const healthScoreData: NamedCount[] = (Object.keys(healthBandCounts) as HealthBand[])
    .filter((band) => healthBandCounts[band] > 0)
    .map((band) => ({ name: HEALTH_BAND_LABELS[band], value: healthBandCounts[band], color: HEALTH_BAND_COLORS[band] }));

  const latestChurnByClient = new Map<string, ChurnBand>();
  for (const s of latestChurnSnapshots) {
    if (!latestChurnByClient.has(s.clientId)) latestChurnByClient.set(s.clientId, s.band as ChurnBand);
  }
  const churnBandCounts: Record<ChurnBand, number> = { BAIXO: 0, MEDIO: 0, ALTO: 0 };
  for (const band of latestChurnByClient.values()) churnBandCounts[band] += 1;
  const churnRiskData: NamedCount[] = (Object.keys(churnBandCounts) as ChurnBand[])
    .filter((band) => churnBandCounts[band] > 0)
    .map((band) => ({ name: CHURN_BAND_LABELS[band], value: churnBandCounts[band], color: CHURN_BAND_COLORS[band] }));

  // --- Financeiro -----------------------------------------------------------
  const expenseByCategory = new Map<string, number>();
  for (const entry of expenseEntries) {
    const key = entry.category?.name ?? "Sem categoria";
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + entry.amountCents);
  }
  const expenseByCategoryData: NamedCount[] = Array.from(expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: colorFor(i) }));

  const ladderAmounts = new Map<CollectionStage | "A_VENCER", number>();
  for (const entry of receivablesOpen) {
    const stage = collectionStageForDueDate(entry.dueDate, now) ?? "A_VENCER";
    ladderAmounts.set(stage, (ladderAmounts.get(stage) ?? 0) + entry.amountCents);
  }
  const LADDER_ORDER: (CollectionStage | "A_VENCER")[] = [
    "A_VENCER",
    "LEMBRETE",
    "VENCIMENTO",
    "ATRASO_1",
    "ATRASO_3",
    "ESCALONAR",
    "RECUPERACAO",
  ];
  const collectionLadderData: NamedCount[] = LADDER_ORDER.filter((stage) => (ladderAmounts.get(stage) ?? 0) > 0).map(
    (stage) => ({
      name: stage === "A_VENCER" ? "A vencer (> 5 dias)" : COLLECTION_STAGE_LABELS[stage],
      value: ladderAmounts.get(stage)!,
      color: stage === "A_VENCER" ? "#CBD5E1" : COLLECTION_STAGE_COLORS[stage],
    }),
  );

  const cashflowMonths: { label: string; previsto: number; realizado: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    cashflowMonths.push({ label: `${MONTH_LABELS_SHORT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, previsto: 0, realizado: 0 });
  }
  for (const entry of revenueEntriesForCashflow) {
    if (entry.status === "LIQUIDADO" && entry.settledDate) {
      const monthsAgo =
        (now.getUTCFullYear() - entry.settledDate.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - entry.settledDate.getUTCMonth());
      const index = 5 - monthsAgo;
      if (index >= 0 && index < cashflowMonths.length) cashflowMonths[index]!.realizado += entry.amountCents;
    } else if (entry.status !== "CANCELADO") {
      const monthsAgo =
        (now.getUTCFullYear() - entry.competencyDate.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - entry.competencyDate.getUTCMonth());
      const index = 5 - monthsAgo;
      if (index >= 0 && index < cashflowMonths.length) cashflowMonths[index]!.previsto += entry.amountCents;
    }
  }

  const accountsReceivableCents = arAggregate._sum.amountCents ?? 0;
  const creditSalesCents = creditSalesAggregate._sum.amountCents ?? 0;
  const dso = computeDSO(accountsReceivableCents, creditSalesCents, INDICATOR_WINDOW_DAYS);
  const clientsAtStart = clientsForIndicators.filter(
    (c) => statusAsOf(c.statusHistory, indicatorPeriodStart) === "ATIVO",
  ).length;
  const churnedInPeriod = clientsForIndicators.filter((c) => {
    const wasAtStart = statusAsOf(c.statusHistory, indicatorPeriodStart) === "ATIVO";
    const isNowEncerrado = statusAsOf(c.statusHistory, now) === "ENCERRADO";
    return wasAtStart && isNowEncerrado;
  }).length;
  const logoChurn = computeLogoChurnRate(clientsAtStart, churnedInPeriod);

  // --- Comercial --------------------------------------------------------
  const opportunitiesByStage = new Map<string, { count: number; valueCents: number }>();
  for (const opp of openOpportunities) {
    const bucket = opportunitiesByStage.get(opp.stageId) ?? { count: 0, valueCents: 0 };
    bucket.count += 1;
    bucket.valueCents += opp.valueCents ?? 0;
    opportunitiesByStage.set(opp.stageId, bucket);
  }
  const pipelineFunnelData = pipelineStages.map((stage) => ({
    label: stage.name,
    quantidade: opportunitiesByStage.get(stage.id)?.count ?? 0,
    valorCents: opportunitiesByStage.get(stage.id)?.valueCents ?? 0,
  }));

  const proposalStatusData: NamedCount[] = proposalsByStatus
    .filter((p) => p._count > 0)
    .map((p, i) => ({ name: PROPOSAL_STATUS_LABELS[p.status as ProposalStatus], value: p._count, color: colorFor(i) }));

  const leadsByMonth: { label: string; leads: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    leadsByMonth.push({ label: `${MONTH_LABELS_SHORT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, leads: 0 });
  }
  for (const lead of leads) {
    const monthsAgo =
      (now.getUTCFullYear() - lead.createdAt.getUTCFullYear()) * 12 + (now.getUTCMonth() - lead.createdAt.getUTCMonth());
    const index = 5 - monthsAgo;
    if (index >= 0 && index < leadsByMonth.length) leadsByMonth[index]!.leads += 1;
  }
  const totalLeads = leads.length;
  const totalOpportunities = opportunitiesByStatus.reduce((sum, entry) => sum + entry._count, 0);
  const wonOpportunities = opportunitiesByStatus.find((entry) => entry.status === "WON")?._count ?? 0;
  const conversionRate = totalOpportunities > 0 ? Math.round((wonOpportunities / totalOpportunities) * 100) : null;

  // --- Operação -----------------------------------------------------------
  const taskStatusCounts = new Map<WorkItemStatus, number>();
  for (const task of openTasks) taskStatusCounts.set(task.status, (taskStatusCounts.get(task.status) ?? 0) + 1);
  const taskStatusData: NamedCount[] = Array.from(taskStatusCounts.entries()).map(([status, value], i) => ({
    name: WORK_ITEM_STATUS_LABELS[status],
    value,
    color: colorFor(i),
  }));

  const workloadByPerson = new Map<string, number>();
  for (const task of openTasks) {
    const key = task.assigneeUserId ?? "__unassigned__";
    workloadByPerson.set(key, (workloadByPerson.get(key) ?? 0) + 1);
  }
  const workloadData = Array.from(workloadByPerson.entries())
    .map(([userId, count]) => ({
      label: userId === "__unassigned__" ? "Não atribuída" : (memberNameById.get(userId) ?? "Ex-membro"),
      tarefas: count,
    }))
    .sort((a, b) => b.tarefas - a.tarefas)
    .slice(0, 8);

  // --- Pessoas --------------------------------------------------------------
  const employeeStatusData: NamedCount[] = employeesByStatus
    .filter((e) => e._count > 0)
    .map((e, i) => ({ name: EMPLOYEE_STATUS_LABELS[e.status as EmployeeStatus], value: e._count, color: colorFor(i) }));

  const hoursByPerson = new Map<string, number>();
  for (const entry of weekTimeEntries) hoursByPerson.set(entry.userId, (hoursByPerson.get(entry.userId) ?? 0) + entry.minutes);
  const hoursData = Array.from(hoursByPerson.entries())
    .map(([userId, minutes]) => ({ label: memberNameById.get(userId) ?? "Ex-membro", horas: Math.round((minutes / 60) * 10) / 10 }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 8);

  // --- Conteúdo -------------------------------------------------------------
  const contentStatusData: NamedCount[] = contentByStatus
    .filter((c) => c._count > 0)
    .map((c, i) => ({ name: CONTENT_STATUS_LABELS[c.status as ContentStatus], value: c._count, color: colorFor(i) }));

  return {
    financeiro: {
      expenseByCategoryData,
      collectionLadderData,
      cashflowMonths,
      dso,
      logoChurn,
      indicatorWindowDays: INDICATOR_WINDOW_DAYS,
    },
    clientes: {
      clientStatusData,
      healthScoreData,
      churnRiskData,
      nps: latestNps ? { score: latestNps.score, campaignName: latestNps.campaign.name, computedAt: latestNps.computedAt } : null,
    },
    comercial: {
      pipelineFunnelData,
      proposalStatusData,
      leadsByMonth,
      totalLeads,
      conversionRate,
    },
    operacao: {
      taskStatusData,
      workloadData,
    },
    pessoas: {
      employeeStatusData,
      hoursData,
      enps: latestEnps
        ? { score: latestEnps.score, campaignName: latestEnps.campaign.name, computedAt: latestEnps.computedAt }
        : null,
    },
    conteudo: {
      contentStatusData,
    },
  };
}

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ATIVO: "Ativo",
  AFASTADO: "Afastado",
  DESLIGADO: "Desligado",
};
