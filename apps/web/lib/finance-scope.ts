import { prisma, type Prisma } from "@zenite-mkt/db";
import { getHiddenClientIds, isClientHidden } from "@/lib/client-access";

/**
 * Zenite × particular (2026-11-12).
 *
 * - **Zenite**: lançamento dividido entre os sócios (duas ou mais partes), em
 *   qualquer proporção.
 * - **Particular**: lançamento de um sócio só. Não conta nada para a Zenite e,
 *   quando o sócio está ligado a um login, só esse usuário vê.
 * - **Não definido**: sem divisão (tudo que foi lançado antes desta regra).
 *   Todos veem e continua contando no negócio até alguém classificar.
 *
 * Toda leitura de `FinanceEntry` nas telas passa por um destes dois filtros:
 * `visibleEntryWhere` (o que este login pode ver) ou `businessEntryWhere`
 * (só o negócio, igual para todos — indicadores, DRE, metas).
 *
 * Cliente particular de outro sócio (`lib/client-access.ts`, 2026-11-13): os
 * lançamentos desse cliente somem para este login em qualquer recorte, mesmo
 * os divididos.
 */
export interface ScopePartner {
  id: string;
  name: string;
  active: boolean;
  userId: string | null;
}

export interface FinanceViewer {
  userId: string;
  partners: ScopePartner[];
  /** Sócio ligado a este login, se houver. */
  myPartnerId: string | null;
  /** Sócios cujo particular este login NÃO vê (ligados a outro usuário). */
  hiddenPartnerIds: string[];
  /** Clientes particulares de outro sócio: nada deles aparece para este login. */
  hiddenClientIds: string[];
}

export function buildFinanceViewer(userId: string, partners: ScopePartner[], hiddenClientIds: string[] = []): FinanceViewer {
  return {
    userId,
    partners,
    hiddenClientIds,
    myPartnerId: partners.find((p) => p.userId === userId)?.id ?? null,
    hiddenPartnerIds: partners.filter((p) => p.userId && p.userId !== userId).map((p) => p.id),
  };
}

export async function loadFinanceViewer(agencyId: string, userId: string): Promise<FinanceViewer> {
  const [partners, hiddenClientIds] = await Promise.all([
    prisma.financePartner.findMany({
      where: { agencyId },
      select: { id: true, name: true, active: true, userId: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    getHiddenClientIds(agencyId, userId),
  ]);
  return buildFinanceViewer(userId, partners, hiddenClientIds);
}

/** "É particular do sócio X": tem parte dele e todas as partes são dele (a parte é única por sócio). */
function particularOf(partnerId: string): Prisma.FinanceEntryWhereInput {
  return { partnerShares: { some: { partnerId }, every: { partnerId } } };
}

function noneOf(partnerIds: string[]): Prisma.FinanceEntryWhereInput {
  return partnerIds.length > 0 ? { NOT: partnerIds.map(particularOf) } : {};
}

/** Acrescenta "fora dos clientes particulares de outro sócio" (sem mudar o filtro quando não há nenhum). */
function withoutHiddenClients(viewer: FinanceViewer, where: Prisma.FinanceEntryWhereInput): Prisma.FinanceEntryWhereInput {
  if (viewer.hiddenClientIds.length === 0) return where;
  return { AND: [where, { OR: [{ clientId: null }, { clientId: { notIn: viewer.hiddenClientIds } }] }] };
}

/** O que este login pode ver: tudo, menos o particular de sócio ligado a outro usuário e os clientes particulares dele. */
export function visibleEntryWhere(viewer: FinanceViewer): Prisma.FinanceEntryWhereInput {
  return withoutHiddenClients(viewer, noneOf(viewer.hiddenPartnerIds));
}

/** Só o negócio: Zenite + não definido, sem particular de ninguém. Não depende de quem está olhando. */
export function businessEntryWhereFor(partnerIds: string[]): Prisma.FinanceEntryWhereInput {
  return noneOf(partnerIds);
}

export async function businessEntryWhere(agencyId: string): Promise<Prisma.FinanceEntryWhereInput> {
  const partners = await prisma.financePartner.findMany({ where: { agencyId }, select: { id: true } });
  return businessEntryWhereFor(partners.map((p) => p.id));
}

/** `?scope=` das telas: "" (tudo que vejo), "zenite", "none" (não definido) ou o id de um sócio (particular dele). */
export const SCOPE_ZENITE = "zenite";
export const SCOPE_NONE = "none";

export interface ScopeOption {
  value: string;
  label: string;
}

/** Recortes que este login pode escolher (particular de outro sócio com login não aparece). */
export function scopeOptions(viewer: FinanceViewer): ScopeOption[] {
  if (viewer.partners.length === 0) return [];
  const visible = viewer.partners.filter((p) => !viewer.hiddenPartnerIds.includes(p.id));
  // O próprio primeiro; desativado só entra se for o do usuário.
  const mine = visible.filter((p) => p.id === viewer.myPartnerId);
  const others = visible.filter((p) => p.id !== viewer.myPartnerId && p.active);
  return [
    { value: "", label: "Tudo" },
    { value: SCOPE_ZENITE, label: "Zenite" },
    ...[...mine, ...others].map((p) => ({ value: p.id, label: p.name })),
    { value: SCOPE_NONE, label: "Não definido" },
  ];
}

/** `?scope=` da URL → recorte válido para este login (qualquer outra coisa vira "tudo"). */
export function parseScope(viewer: FinanceViewer, raw: string | undefined): string {
  return scopeOptions(viewer).some((o) => o.value === raw) ? (raw as string) : "";
}

/** Filtro do recorte escolhido — sempre dentro do que o login pode ver. */
export function scopeEntryWhere(viewer: FinanceViewer, scope: string): Prisma.FinanceEntryWhereInput {
  if (scope === SCOPE_ZENITE) return withoutHiddenClients(viewer, { AND: [{ partnerShares: { some: {} } }, noneOf(viewer.partners.map((p) => p.id))] });
  if (scope === SCOPE_NONE) return withoutHiddenClients(viewer, { partnerShares: { none: {} } });
  if (scope && !viewer.hiddenPartnerIds.includes(scope)) return withoutHiddenClients(viewer, particularOf(scope));
  return visibleEntryWhere(viewer);
}

/** Classificação de um lançamento já carregado (mesma regra dos filtros acima). */
export function entryScopeOf(shares: { partnerId: string }[]): { kind: "none" | "zenite" | "particular"; partnerId?: string } {
  if (shares.length === 0) return { kind: "none" };
  if (shares.length === 1) return { kind: "particular", partnerId: shares[0]!.partnerId };
  return { kind: "zenite" };
}

export function canSeeEntry(viewer: FinanceViewer, shares: { partnerId: string }[], clientId?: string | null): boolean {
  if (isClientHidden(viewer.hiddenClientIds, clientId)) return false;
  const scope = entryScopeOf(shares);
  return scope.kind !== "particular" || !viewer.hiddenPartnerIds.includes(scope.partnerId!);
}

/**
 * Para as rotas que agem num lançamento pelo id: `false` se ele é particular
 * de outro sócio (a rota responde 404, como se não existisse).
 */
export async function canActOnEntry(agencyId: string, userId: string, financeEntryId: string): Promise<boolean> {
  const [viewer, shares, entry] = await Promise.all([
    loadFinanceViewer(agencyId, userId),
    prisma.financeEntryShare.findMany({ where: { financeEntryId }, select: { partnerId: true } }),
    prisma.financeEntry.findUnique({ where: { id: financeEntryId }, select: { clientId: true } }),
  ]);
  return canSeeEntry(viewer, shares, entry?.clientId);
}
