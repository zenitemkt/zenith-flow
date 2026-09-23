import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { isEmailConfigured, sendNpsInviteEmail } from "@/lib/email";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * "Enviar" transiciona RASCUNHO -> ENVIADA e, quando o Resend está
 * configurado, dispara um e-mail de verdade pra cada destinatário pendente
 * (falha individual não derruba o lote nem a campanha). Sem Resend
 * configurado, mantém o comportamento antigo: marca todos ENVIADO em lote,
 * sem enviar nada — o link público continua disponível pra copiar/compartilhar
 * manualmente. Ver docs/DECISIONS.md.
 */
export async function POST(request: Request, { params }: RouteParams) {
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
    include: { recipients: { where: { status: "PENDENTE" } } },
  });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }
  if (campaign.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Esta pesquisa já foi enviada." }, { status: 400 });
  }
  if (campaign.recipients.length === 0) {
    return NextResponse.json({ error: "Nenhum destinatário para enviar." }, { status: 400 });
  }

  const now = new Date();
  const origin = new URL(request.url).origin;
  let sent = 0;
  let failed = 0;

  if (isEmailConfigured()) {
    for (const recipient of campaign.recipients) {
      try {
        await sendNpsInviteEmail({
          to: recipient.email,
          contactName: recipient.contactName,
          campaignName: campaign.name,
          question: campaign.question,
          publicUrl: `${origin}/pesquisa/${recipient.token}`,
          agencyName: membership.agency.name,
        });
        await prisma.surveyRecipient.update({ where: { id: recipient.id }, data: { status: "ENVIADO", sentAt: now } });
        sent += 1;
      } catch {
        failed += 1;
      }
    }
  } else {
    await prisma.surveyRecipient.updateMany({
      where: { campaignId: campaign.id, status: "PENDENTE" },
      data: { status: "ENVIADO", sentAt: now },
    });
    sent = campaign.recipients.length;
  }

  await prisma.$transaction(async (tx) => {
    await tx.surveyCampaign.update({ where: { id: campaign.id }, data: { status: "ENVIADA", sentAt: now } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "survey_campaign.sent",
        resourceType: "survey_campaign",
        resourceId: campaign.id,
        metadata: { sent, failed },
      },
    });
  });

  return NextResponse.json({ ok: true, sent, failed });
}
