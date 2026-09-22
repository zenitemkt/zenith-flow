import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "./session";
import { isClientRole } from "./rbac";
import { prisma } from "@zenite-mkt/db";

/**
 * Seção 18 do manual: o Portal do Cliente reaproveita a mesma sessão
 * (Better Auth) e o mesmo Membership da Fase 1A — um contato de cliente
 * convidado vira um Membership com role CLIENT_ADMIN/CLIENT_VIEWER,
 * workspaceId apontando pro Workspace(kind: CLIENT) do próprio cliente.
 * Sem sistema de login separado.
 */
export async function requirePortalContext() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session) redirect("/login");
  if (!membership || !isClientRole(membership.role)) redirect("/");

  const client = await prisma.client.findUnique({ where: { workspaceId: membership.workspaceId } });
  if (!client) redirect("/login");

  return { session, membership, client };
}
