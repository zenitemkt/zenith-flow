import { cache } from "react";
import { headers, cookies } from "next/headers";
import { auth } from "./auth";
import { prisma } from "@zenith/db";

/**
 * `cache()` do React dedupe chamadas com os mesmos argumentos dentro da MESMA
 * requisição/render (layout + page + componentes aninhados todos chamam isto
 * várias vezes por navegação) — sem isso cada camada refaz a query de sessão
 * no banco. Não persiste entre requisições diferentes (escopo por request).
 */
export const getServerSession = cache(async function getServerSession() {
  return auth.api.getSession({ headers: headers() });
});

/** Cookie que guarda qual agência está ativa na sessão (seletor no menu). */
export const CURRENT_AGENCY_COOKIE = "zf-agency-id";

/**
 * `select` explícito em vez de `include: { agency: true, workspace: true }`:
 * só `agency.name` e `agency.trackingWriteKey` são usados em todo o código
 * (`membership.workspace` nunca é lido) — evita trazer a linha inteira de
 * `Agency`/`Workspace` em ~50 pontos de chamada por request.
 */
const MEMBERSHIP_SELECT = {
  id: true,
  userId: true,
  email: true,
  agencyId: true,
  workspaceId: true,
  role: true,
  status: true,
  invitedByUserId: true,
  inviteToken: true,
  inviteExpiresAt: true,
  createdAt: true,
  updatedAt: true,
  agency: { select: { name: true, trackingWriteKey: true } },
} as const;

/**
 * Todas as memberships ATIVAS do usuário — normalmente 1, mas um usuário
 * pode pertencer a mais de uma agência (ex.: conta pessoal separada da
 * agência principal). Alimenta o seletor de agência no menu.
 */
export const getActiveMemberships = cache(async function getActiveMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: "ACTIVE" },
    select: MEMBERSHIP_SELECT,
    orderBy: { createdAt: "asc" },
  });
});

/**
 * Membership "ativa" na sessão atual: a apontada pelo cookie
 * `zf-agency-id` (setado ao trocar de agência no seletor do menu), ou a
 * primeira membership do usuário quando não há cookie ou ele não pertence
 * (mais) à agência marcada — mesmo fallback determinístico de antes de
 * existir troca de agência.
 */
export const getCurrentMembership = cache(async function getCurrentMembership(userId: string) {
  const memberships = await getActiveMemberships(userId);
  if (memberships.length === 0) return null;
  const preferredAgencyId = cookies().get(CURRENT_AGENCY_COOKIE)?.value;
  const preferred = preferredAgencyId
    ? memberships.find((m) => m.agencyId === preferredAgencyId)
    : undefined;
  return preferred ?? memberships[0]!;
});

export const getUserThemePreference = cache(async function getUserThemePreference(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { themePreference: true } });
  return user?.themePreference ?? "LIGHT";
});

export async function requireSessionAndMembership() {
  const session = await getServerSession();
  if (!session) return { session: null, membership: null };
  const membership = await getCurrentMembership(session.user.id);
  return { session, membership };
}
