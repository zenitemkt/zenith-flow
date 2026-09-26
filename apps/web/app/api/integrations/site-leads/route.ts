import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getCurrentMembership, getServerSession } from "@/lib/session";
import { canManageIntegrations } from "@/lib/rbac";

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageIntegrations(membership.role)) {
    return NextResponse.json({ error: "Apenas administradores podem gerenciar integrações." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  const configuredForAgency =
    Boolean(process.env.SITE_LEADS_SECRET) && process.env.SITE_LEADS_AGENCY_ID === membership.agencyId;
  if (body.enabled && !configuredForAgency) {
    return NextResponse.json({ error: "A conexão ainda não está configurada na infraestrutura." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.agency.update({
      where: { id: membership.agencyId },
      data: { siteLeadIntegrationEnabled: body.enabled },
    }),
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: body.enabled ? "integration.connected" : "integration.disconnected",
        resourceType: "site_lead_integration",
        resourceId: membership.agencyId,
        metadata: { integration: "zenite_hub_budget_form" },
      },
    }),
  ]);

  return NextResponse.json({ enabled: body.enabled });
}