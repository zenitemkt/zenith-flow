import * as React from "react";
import { prisma } from "@zenite-mkt/db";

// `cache` só existe no ambiente de Server Components; nos testes vira identidade.
const cache: <T extends (...args: never[]) => unknown>(fn: T) => T = typeof React.cache === "function" ? React.cache : (fn) => fn;

/**
 * Cliente particular de um sócio (2026-11-13).
 *
 * "Quem recebe deste cliente" com UM sócio só, e esse sócio ligado a um login,
 * faz o cliente ser só desse login: o outro sócio (e qualquer outro usuário da
 * agência) não vê o cliente nem nada dele — carteira, Operação, tarefas,
 * financeiro, comercial, tráfego, automações e indicadores.
 *
 * - Dividido entre sócios (Zenite) ou sem divisão definida: todos veem.
 * - Sócio sem login ligado: todos veem (mesma regra de `finance-scope.ts`).
 *
 * Só vale para as telas e APIs da equipe. Crons, webhooks e o portal do
 * cliente não passam por aqui.
 */
export interface ClientShareRow {
  clientId: string;
  partnerId: string;
}

export interface PartnerLoginRow {
  id: string;
  userId: string | null;
}

/** Clientes que `userId` não pode ver, a partir das divisões e dos vínculos sócio ↔ login. */
export function computeHiddenClientIds(userId: string, shares: ClientShareRow[], partners: PartnerLoginRow[]): string[] {
  const loginOf = new Map(partners.map((p) => [p.id, p.userId]));
  const partnersByClient = new Map<string, Set<string>>();
  for (const s of shares) {
    const set = partnersByClient.get(s.clientId) ?? new Set<string>();
    set.add(s.partnerId);
    partnersByClient.set(s.clientId, set);
  }
  const hidden: string[] = [];
  for (const [clientId, set] of partnersByClient) {
    if (set.size !== 1) continue;
    const owner = loginOf.get([...set][0]!);
    if (owner && owner !== userId) hidden.push(clientId);
  }
  return hidden.sort();
}

/** Ids de cliente ocultos para este login nesta agência (memoizado por requisição). */
export const getHiddenClientIds = cache(async function getHiddenClientIds(agencyId: string, userId: string): Promise<string[]> {
  const [shares, partners] = await Promise.all([
    prisma.clientPartnerShare.findMany({ where: { client: { agencyId } }, select: { clientId: true, partnerId: true } }),
    prisma.financePartner.findMany({ where: { agencyId }, select: { id: true, userId: true } }),
  ]);
  return computeHiddenClientIds(userId, shares, partners);
});

/** Filtro para `prisma.client`: só os clientes visíveis. */
export function visibleClientWhere(hidden: string[]) {
  return hidden.length > 0 ? { id: { notIn: hidden } } : {};
}

/** Filtro para modelos com `clientId` obrigatório. */
export function visibleByClientWhere(hidden: string[]) {
  return hidden.length > 0 ? { clientId: { notIn: hidden } } : {};
}

/**
 * Filtro para modelos com `clientId` opcional: esconde os registros dos clientes
 * ocultos e mantém os sem cliente (`notIn` sozinho descartaria os nulos). Usar
 * dentro de `AND` quando a consulta já tiver `OR`.
 */
export function visibleByOptionalClientWhere(hidden: string[]) {
  return hidden.length > 0 ? { OR: [{ clientId: null }, { clientId: { notIn: hidden } }] } : {};
}

export function isClientHidden(hidden: string[], clientId: string | null | undefined): boolean {
  return Boolean(clientId) && hidden.includes(clientId!);
}

/** Atalho para rotas e páginas: `true` se este login pode ver o cliente (ou se não há cliente). */
export async function canSeeClient(agencyId: string, userId: string, clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return true;
  return !isClientHidden(await getHiddenClientIds(agencyId, userId), clientId);
}
