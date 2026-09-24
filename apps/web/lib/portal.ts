import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

const PORTAL_HOST = process.env.PORTAL_HOST ?? "portal.hubzenite.com.br";
const MAIN_APP_URL = process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://zenith-flow-one.vercel.app";

export async function requirePortalContext() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session) redirect("/login");

  if (!membership || !isClientRole(membership.role)) {
    // BRIEFING_PORTAL_SUBDOMINIO.md (seção 6, decisão 3): equipe interna que
    // loga direto em portal.hubzenite.com.br não tem "/" pra voltar nesse
    // host (o middleware só expõe o portal ali) — manda pro domínio
    // principal em vez de gerar um loop de redirecionamento.
    if (headers().get("host") === PORTAL_HOST) {
      redirect(MAIN_APP_URL);
    }
    redirect("/");
  }

  const client = await prisma.client.findUnique({ where: { workspaceId: membership.workspaceId } });
  if (!client) redirect("/login");

  return { session, membership, client };
}
