import type { ClientStatus, LeadStatus } from "@zenite-mkt/db";
import { prisma } from "@zenite-mkt/db";
import { CLIENT_STATUS_LABELS } from "./clients";
import { LEAD_STATUS_LABELS } from "./leads";

export const ALL_CLIENT_STATUSES: ClientStatus[] = [
  "PROSPECT",
  "ONBOARDING",
  "ATIVO",
  "PAUSADO",
  "EM_ENCERRAMENTO",
  "ENCERRADO",
  "REATIVADO",
];

/** CONVERTIDO nunca entra aqui — quem converteu já é listado do lado de Clientes, sem duplicar a pessoa. */
export const ALL_LEAD_STATUSES: LeadStatus[] = ["NOVO", "EM_ANDAMENTO", "QUALIFICADO", "DESQUALIFICADO"];

export interface MarketingFilters {
  clientStatuses: ClientStatus[];
  leadStatuses: LeadStatus[];
  stageIds: string[];
}

/**
 * `getAll` é o adaptador de leitura de query string — `URLSearchParams.getAll`
 * na rota de exportação, e um wrapper sobre `searchParams` (prop do Next, que
 * vem como string | string[] | undefined por chave) na página. Um checkbox
 * desmarcado simplesmente não aparece na query string, então a única forma de
 * distinguir "nunca filtrou" (primeira visita, sem nenhum parâmetro) de
 * "desmarcou tudo de propósito" é `hasAnyParam` — sem ele, a primeira visita
 * mostraria 0 resultados em vez de tudo.
 */
export function parseMarketingFilters(getAll: (key: string) => string[], hasAnyParam: boolean): MarketingFilters {
  if (!hasAnyParam) {
    return { clientStatuses: ALL_CLIENT_STATUSES, leadStatuses: ALL_LEAD_STATUSES, stageIds: [] };
  }
  const clientStatuses = getAll("clientStatus").filter((s): s is ClientStatus =>
    (ALL_CLIENT_STATUSES as string[]).includes(s),
  );
  const leadStatuses = getAll("leadStatus").filter((s): s is LeadStatus => (ALL_LEAD_STATUSES as string[]).includes(s));
  const stageIds = getAll("stageId");
  return { clientStatuses, leadStatuses, stageIds };
}

export interface MarketingContactRow {
  type: "Cliente" | "Lead";
  name: string;
  company: string | null;
  status: string;
  phone: string | null;
  email: string | null;
}

/**
 * Uma linha por contato elegível (não por cliente/lead) — é o que interessa
 * pra disparo de e-mail/WhatsApp, já que cada pessoa recebe separadamente.
 * `ClientContact.marketingOptOut` é sempre respeitado (mesma regra já usada
 * pelas campanhas de NPS em `clientes/nps/page.tsx`) — nunca vira destinatário.
 */
export async function fetchMarketingRows(agencyId: string, filters: MarketingFilters): Promise<MarketingContactRow[]> {
  const rows: MarketingContactRow[] = [];

  if (filters.clientStatuses.length > 0) {
    const clients = await prisma.client.findMany({
      where: {
        agencyId,
        status: { in: filters.clientStatuses },
        ...(filters.stageIds.length > 0
          ? { opportunities: { some: { status: "OPEN", stageId: { in: filters.stageIds } } } }
          : {}),
      },
      select: {
        name: true,
        status: true,
        contacts: { select: { name: true, email: true, phone: true, marketingOptOut: true } },
      },
    });
    for (const client of clients) {
      for (const contact of client.contacts) {
        if (contact.marketingOptOut) continue;
        if (!contact.email && !contact.phone) continue;
        rows.push({
          type: "Cliente",
          name: contact.name,
          company: client.name,
          status: CLIENT_STATUS_LABELS[client.status],
          phone: contact.phone,
          email: contact.email,
        });
      }
    }
  }

  if (filters.leadStatuses.length > 0) {
    const leads = await prisma.lead.findMany({
      where: {
        agencyId,
        status: { in: filters.leadStatuses },
        ...(filters.stageIds.length > 0
          ? { opportunities: { some: { status: "OPEN", stageId: { in: filters.stageIds } } } }
          : {}),
      },
      select: { name: true, company: true, status: true, email: true, phone: true },
    });
    for (const lead of leads) {
      if (!lead.email && !lead.phone) continue;
      rows.push({
        type: "Lead",
        name: lead.name,
        company: lead.company,
        status: LEAD_STATUS_LABELS[lead.status],
        phone: lead.phone,
        email: lead.email,
      });
    }
  }

  return rows;
}

/** `;` como separador (padrão do Excel em PT-BR) + BOM UTF-8 pra acentuação abrir certa. */
export function buildMarketingCsv(rows: MarketingContactRow[]): string {
  const header = ["Nome", "Empresa", "Tipo", "Status", "Telefone/WhatsApp", "E-mail"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [header.map(escape).join(";")];
  for (const row of rows) {
    lines.push(
      [row.name, row.company ?? "", row.type, row.status, row.phone ?? "", row.email ?? ""].map(escape).join(";"),
    );
  }
  return "﻿" + lines.join("\r\n");
}
