import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canViewEnps } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Mesmo padrão do NPS de clientes: sem provedor de e-mail integrado ainda — o link público fica disponível para copiar. */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (!canViewEnps(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const campaign = await prisma.enpsCampaign.findUnique({
    where: { id: params.id },
    include: { _count: { select: { invites: true } } },
  });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }
  if (campaign.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Esta pesquisa já foi enviada." }, { status: 400 });
  }
  if (campaign._count.invites === 0) {
    return NextResponse.json({ error: "Nenhum convite para enviar." }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.enpsCampaign.update({ where: { id: campaign.id }, data: { status: "ENVIADA", sentAt: now } });
    await tx.enpsInvite.updateMany({
      where: { campaignId: campaign.id, status: "PENDENTE" },
      data: { status: "ENVIADO", sentAt: now },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "enps_campaign.sent",
        resourceType: "enps_campaign",
        resourceId: campaign.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
