import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "@zenith/db";

export async function getServerSession() {
  return auth.api.getSession({ headers: headers() });
}

/**
 * MVP de 1A: um usuário pertence a uma única agência (a que criou ou para a
 * qual foi convidado). Troca entre múltiplas agências é FUTURO (seção 7.3 do
 * manual — seletor de workspace) e será implementada quando fizer sentido.
 */
export async function getCurrentMembership(userId: string) {
  return prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { agency: true, workspace: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireSessionAndMembership() {
  const session = await getServerSession();
  if (!session) return { session: null, membership: null };
  const membership = await getCurrentMembership(session.user.id);
  return { session, membership };
}
