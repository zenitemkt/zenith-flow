import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";
import { decryptSecret } from "@/lib/crypto-secrets";
import { importRecentLeads, listLeadForms, subscribePageToLeads } from "@/lib/meta-lead-ads";

export const maxDuration = 60;

async function authorize() {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || !canManageIntegrations(membership.role)) return { error: NextResponse.json({ error: "Apenas administradores." }, { status: 403 }) };
  return { membership, userId: session.user.id };
}

async function loadConnection(agencyId: string, connectionId: unknown) {
  if (typeof connectionId !== "string") return null;
  return prisma.socialConnection.findFirst({ where: { id: connectionId, agencyId, platform: "FACEBOOK" } });
}

/** Formulários da Página (também confirma que o token tem `leads_retrieval`). */
export async function GET(request: Request) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const connection = await loadConnection(auth.membership.agencyId, new URL(request.url).searchParams.get("connectionId"));
  if (!connection) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  try {
    return NextResponse.json({ forms: await listLeadForms(connection.externalId, decryptSecret(connection.accessTokenEnc)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao listar formulários." }, { status: 502 });
  }
}

/** Liga/desliga a entrada de leads da Página no CRM. Ligar assina o webhook `leadgen`. */
export async function PATCH(request: Request) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const connection = await loadConnection(auth.membership.agencyId, body?.connectionId);
  if (!connection) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  const enabled = body?.enabled === true;

  if (enabled) {
    try {
      await subscribePageToLeads(connection.externalId, decryptSecret(connection.accessTokenEnc));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao assinar o webhook.";
      await prisma.socialConnection.update({ where: { id: connection.id }, data: { leadsLastError: message } });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }
  await prisma.socialConnection.update({
    where: { id: connection.id },
    data: { leadsEnabled: enabled, leadsLastError: null, ...(enabled ? { leadsSubscribedAt: new Date() } : {}) },
  });
  await prisma.auditLog.create({
    data: {
      agencyId: auth.membership.agencyId,
      actorUserId: auth.userId,
      actorType: "user",
      action: enabled ? "meta_leads.enabled" : "meta_leads.disabled",
      resourceType: "social_connection",
      resourceId: connection.id,
      metadata: { pageId: connection.externalId },
    },
  });
  return NextResponse.json({ ok: true });
}

/** Importa os leads dos últimos 90 dias (sem duplicar). */
export async function POST(request: Request) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const connection = await loadConnection(auth.membership.agencyId, body?.connectionId);
  if (!connection?.leadsEnabled) return NextResponse.json({ error: "Ative a integração antes de importar." }, { status: 400 });
  try {
    return NextResponse.json(await importRecentLeads(connection));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao importar." }, { status: 502 });
  }
}
