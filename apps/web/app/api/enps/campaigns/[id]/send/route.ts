import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canViewEnps } from "@/lib/rbac";
import { isEmailConfigured, sendEnpsInviteEmail } from "@/lib/email";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Mesmo padrão do NPS de clientes: envia e-mail de verdade quando o Resend está configurado, senão só marca ENVIADO em lote (link público pra copiar). */
export async function POST(request: Request, { params }: RouteParams) {
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
    include: { invites: { where: { status: "PENDENTE" }, include: { employee: { select: { name: true } } } } },
  });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }
  if (campaign.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Esta pesquisa já foi enviada." }, { status: 400 });
  }
  if (campaign.invites.length === 0) {
    return NextResponse.json({ error: "Nenhum convite para enviar." }, { status: 400 });
  }

  const now = new Date();
  const origin = new URL(request.url).origin;
  let sent = 0;
  let failed = 0;

  if (isEmailConfigured()) {
    for (const invite of campaign.invites) {
      try {
        await sendEnpsInviteEmail({
          to: invite.email,
          employeeName: invite.employee.name,
          campaignName: campaign.name,
          question: campaign.question,
          publicUrl: `${origin}/pesquisa-interna/${invite.token}`,
          agencyName: membership.agency.name,
        });
        await prisma.enpsInvite.update({ where: { id: invite.id }, data: { status: "ENVIADO", sentAt: now } });
        sent += 1;
      } catch {
        failed += 1;
      }
    }
  } else {
    await prisma.enpsInvite.updateMany({
      where: { campaignId: campaign.id, status: "PENDENTE" },
      data: { status: "ENVIADO", sentAt: now },
    });
    sent = campaign.invites.length;
  }

  await prisma.$transaction(async (tx) => {
    await tx.enpsCampaign.update({ where: { id: campaign.id }, data: { status: "ENVIADA", sentAt: now } });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "enps_campaign.sent",
        resourceType: "enps_campaign",
        resourceId: campaign.id,
        metadata: { sent, failed },
      },
    });
  });

  return NextResponse.json({ ok: true, sent, failed });
}
