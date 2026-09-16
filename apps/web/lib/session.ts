import { cache } from "react";
import { headers } from "next/headers";
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

/**
 * MVP de 1A: um usuário pertence a uma única agência (a que criou ou para a
 * qual foi convidado). Troca entre múltiplas agências é FUTURO (seção 7.3 do
 * manual — seletor de workspace) e será implementada quando fizer sentido.
 */
/**
 * `select` explícito em vez de `include: { agency: true, workspace: true }`:
 * só `agency.name` e `agency.trackingWriteKey` são usados em todo o código
 * (`membership.workspace` nunca é lido) — evita trazer a linha inteira de
 * `Agency`/`Workspace` em ~50 pontos de chamada por request.
 */
export const getCurrentMembership = cache(async function getCurrentMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
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
    },
    orderBy: { createdAt: "asc" },
  });
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
