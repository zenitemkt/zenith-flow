import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * "Enviar" nesta fatia é RASCUNHO -> ENVIADA + marcar os destinatários como
 * ENVIADO — não existe provedor de e-mail integrado ainda (decisão do
 * usuário: adiar envio real até escolher um provedor). O link público de
 * cada destinatário fica disponível pra copiar/compartilhar manualmente.
 * Ver docs/DECISIONS.md.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const campaign = await prisma.surveyCampaign.findUnique({
    where: { id: params.id },
    include: { _count: { select: { recipients: true } } },
  });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }
  if (campaign.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Esta pesquisa já foi enviada." }, { status: 400 });
  }
  if (campaign._count.recipients === 0) {
    return NextResponse.json({ error: "Nenhum destinatário para enviar." }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.surveyCampaign.update({ where: { id: campaign.id }, data: { status: "ENVIADA", sentAt: now } });
    await tx.surveyRecipient.updateMany({
      where: { campaignId: campaign.id, status: "PENDENTE" },
      data: { status: "ENVIADO", sentAt: now },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "survey_campaign.sent",
        resourceType: "survey_campaign",
        resourceId: campaign.id,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
