import { cache } from "react";
import { prisma, type CommercialAlertType } from "@zenite-mkt/db";
import { syncCommercialAlerts } from "./commercial-intelligence";

export type CommercialPendingPriority = "URGENT" | "TODAY" | "FOLLOW_UP" | "NEW";
export type CommercialPendingKind =
  | "UNATTENDED_LEAD"
  | "NEW_LEAD"
  | "QUALIFIED_WITHOUT_PROPOSAL"
  | "PROPOSAL_NOT_VIEWED"
  | "PROPOSAL_WITHOUT_RESPONSE"
  | "PROPOSAL_EXPIRED"
  | "PAYMENT_PENDING"
  | CommercialAlertType;

export interface CommercialPendingItem {
  id: string;
  kind: CommercialPendingKind;
  priority: CommercialPendingPriority;
  title: string;
  detail: string;
  href: string;
  occurredAt: string;
  /** Só presente pra itens vindos de `CommercialAlert` — são os únicos com resolver/ignorar manual (os demais se resolvem sozinhos quando o dado muda). */
  alertId?: string;
}

export interface CommercialPendingSummary {
  newLeads: number;
  unattendedLeads: number;
  proposalsAwaiting: number;
  pendingPayments: number;
  behaviorSignals: number;
  total: number;
}

/**
 * `HOT_LEAD`/`CLIENT_RETURNED`/`RETURNED_AFTER_PROPOSAL` pedem ação logo (a
 * janela de interesse é curta); `RETURNING_LEAD`/`FORM_ABANDONED` são sinais
 * mais brandos de acompanhamento.
 */
const ALERT_PRIORITY: Record<CommercialAlertType, CommercialPendingPriority> = {
  HOT_LEAD: "TODAY",
  CLIENT_RETURNED: "TODAY",
  RETURNED_AFTER_PROPOSAL: "TODAY",
  RETURNING_LEAD: "FOLLOW_UP",
  FORM_ABANDONED: "FOLLOW_UP",
};

export interface CommercialPendencies {
  items: CommercialPendingItem[];
  summary: CommercialPendingSummary;
}

const HOUR = 60 * 60 * 1000;
const PRIORITY_ORDER: Record<CommercialPendingPriority, number> = { URGENT: 0, TODAY: 1, FOLLOW_UP: 2, NEW: 3 };

function hoursSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / HOUR));
}

function ageLabel(date: Date, now: Date) {
  const hours = hoursSince(date, now);
  if (hours < 1) return "há menos de 1 hora";
  if (hours < 24) return `há ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

/**
 * Recalcula e persiste os alertas de comportamento (`CommercialAlert`) antes
 * de ler — varre sessão/evento de tracking da agência inteira, então só roda
 * na página dedicada de Pendências, nunca em `getCommercialPendencies` puro
 * (chamado em TODA página pelo layout, pro sino de notificação).
 */
export async function refreshCommercialAlerts(agencyId: string): Promise<void> {
  await syncCommercialAlerts(agencyId);
}

/**
 * Versão sem cache — usada pela página de Pendências logo após
 * `refreshCommercialAlerts`, pra garantir leitura fresca mesmo que o layout
 * já tenha chamado (e memoizado via `cache()`) a versão de baixo, de outra
 * requisição concorrente da mesma renderização.
 */
export async function computeCommercialPendencies(agencyId: string): Promise<CommercialPendencies> {
  const now = new Date();
  const [opportunities, proposals, alerts] = await Promise.all([
    prisma.opportunity.findMany({
      where: { agencyId, status: "OPEN" },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        stage: { select: { kind: true } },
        lead: { select: { id: true, name: true } },
        proposals: { select: { id: true } },
      },
    }),
    prisma.proposal.findMany({
      where: { agencyId, status: { in: ["ENVIADA", "VISUALIZADA", "ACEITA"] } },
      select: {
        id: true,
        name: true,
        status: true,
        sentAt: true,
        viewedAt: true,
        respondedAt: true,
        expiresAt: true,
        updatedAt: true,
        lead: { select: { name: true } },
        client: { select: { name: true } },
        financeEntries: { where: { type: "RECEITA", status: { notIn: ["LIQUIDADO", "CANCELADO"] } }, select: { id: true } },
      },
    }),
    prisma.commercialAlert.findMany({
      where: { agencyId, status: "OPEN" },
      select: { id: true, leadId: true, type: true, title: true, detail: true, detectedAt: true },
    }),
  ]);

  const items: CommercialPendingItem[] = [];

  for (const opportunity of opportunities) {
    if (!opportunity.lead) continue;
    if (opportunity.stage.kind === "NEW_CONTACT") {
      const hours = hoursSince(opportunity.updatedAt, now);
      items.push({
        id: `opportunity:${opportunity.id}`,
        kind: hours >= 24 ? "UNATTENDED_LEAD" : "NEW_LEAD",
        priority: hours >= 24 ? "URGENT" : "NEW",
        title: hours >= 24 ? `${opportunity.lead.name} aguarda atendimento` : `Novo lead: ${opportunity.lead.name}`,
        detail: hours >= 24 ? `Sem avanço na pipeline ${ageLabel(opportunity.updatedAt, now)}.` : `Entrou na pipeline ${ageLabel(opportunity.createdAt, now)}.`,
        href: `/comercial/leads/${opportunity.lead.id}`,
        occurredAt: opportunity.updatedAt.toISOString(),
      });
    } else if (opportunity.stage.kind === "QUALIFIED" && opportunity.proposals.length === 0) {
      items.push({
        id: `qualified:${opportunity.id}`,
        kind: "QUALIFIED_WITHOUT_PROPOSAL",
        priority: "FOLLOW_UP",
        title: `${opportunity.lead.name} está qualificado sem proposta`,
        detail: `Oportunidade aguardando proposta ${ageLabel(opportunity.updatedAt, now)}.`,
        href: `/comercial/leads/${opportunity.lead.id}`,
        occurredAt: opportunity.updatedAt.toISOString(),
      });
    }
  }

  for (const proposal of proposals) {
    const contact = proposal.client?.name ?? proposal.lead?.name ?? proposal.name;
    const baseDate = proposal.viewedAt ?? proposal.sentAt ?? proposal.updatedAt;
    const href = `/comercial/propostas/${proposal.id}`;
    if ((proposal.status === "ENVIADA" || proposal.status === "VISUALIZADA") && proposal.expiresAt && proposal.expiresAt < now) {
      items.push({ id: `expired:${proposal.id}`, kind: "PROPOSAL_EXPIRED", priority: "URGENT", title: `Proposta de ${contact} venceu`, detail: "A proposta expirou sem uma decisão registrada.", href, occurredAt: proposal.expiresAt.toISOString() });
    } else if (proposal.status === "ENVIADA" && hoursSince(baseDate, now) >= 24) {
      items.push({ id: `not-viewed:${proposal.id}`, kind: "PROPOSAL_NOT_VIEWED", priority: "FOLLOW_UP", title: `Proposta de ${contact} ainda não foi visualizada`, detail: `Enviada ${ageLabel(baseDate, now)}.`, href, occurredAt: baseDate.toISOString() });
    } else if (proposal.status === "VISUALIZADA" && hoursSince(baseDate, now) >= 48) {
      items.push({ id: `no-response:${proposal.id}`, kind: "PROPOSAL_WITHOUT_RESPONSE", priority: "FOLLOW_UP", title: `Proposta de ${contact} está sem resposta`, detail: `Visualizada ${ageLabel(baseDate, now)} e ainda sem decisão.`, href, occurredAt: baseDate.toISOString() });
    }
    if (proposal.status === "ACEITA" && proposal.financeEntries.length > 0) {
      items.push({ id: `payment:${proposal.id}`, kind: "PAYMENT_PENDING", priority: "TODAY", title: `Pagamento pendente de ${contact}`, detail: "A proposta foi aceita, mas existe recebimento em aberto.", href, occurredAt: (proposal.respondedAt ?? proposal.updatedAt).toISOString() });
    }
  }

  for (const alert of alerts) {
    items.push({
      id: `alert:${alert.id}`,
      alertId: alert.id,
      kind: alert.type,
      priority: ALERT_PRIORITY[alert.type],
      title: alert.title,
      detail: alert.detail,
      href: `/comercial/leads/${alert.leadId}`,
      occurredAt: alert.detectedAt.toISOString(),
    });
  }

  items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.occurredAt.localeCompare(a.occurredAt));
  const summary = {
    newLeads: items.filter((item) => item.kind === "NEW_LEAD").length,
    unattendedLeads: items.filter((item) => item.kind === "UNATTENDED_LEAD").length,
    proposalsAwaiting: items.filter((item) => ["QUALIFIED_WITHOUT_PROPOSAL", "PROPOSAL_NOT_VIEWED", "PROPOSAL_WITHOUT_RESPONSE", "PROPOSAL_EXPIRED"].includes(item.kind)).length,
    pendingPayments: items.filter((item) => item.kind === "PAYMENT_PENDING").length,
    behaviorSignals: items.filter((item) => item.alertId !== undefined).length,
    total: items.length,
  };
  return { items, summary };
}

export const getCommercialPendencies = cache(computeCommercialPendencies);
