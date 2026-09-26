import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Personalização (pergunta, comentário, cabeçalho, rodapé) só é editável enquanto RASCUNHO — depois de enviada, os destinatários já viram o conteúdo. */
export async function PATCH(request: Request, { params }: RouteParams) {
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

  const campaign = await prisma.surveyCampaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  }
  if (campaign.status !== "RASCUNHO") {
    return NextResponse.json({ error: "Só é possível editar enquanto a pesquisa está em rascunho." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  const question = optionalString(body?.question);
  if (!name || !question) {
    return NextResponse.json({ error: "Nome e pergunta são obrigatórios." }, { status: 400 });
  }

  await prisma.surveyCampaign.update({
    where: { id: campaign.id },
    data: {
      name,
      question,
      commentPrompt: optionalString(body?.commentPrompt),
      headerText: optionalString(body?.headerText),
      footerText: optionalString(body?.footerText),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (!canManageTeam(membership.role)) return NextResponse.json({ error: "Apenas administradores podem excluir pesquisas de NPS." }, { status: 403 });
  const campaign = await prisma.surveyCampaign.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true, name: true } });
  if (!campaign || campaign.agencyId !== membership.agencyId) return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.surveyCampaign.delete({ where: { id: campaign.id } });
    await tx.auditLog.create({ data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "nps_campaign.deleted", resourceType: "survey_campaign", resourceId: campaign.id, metadata: { name: campaign.name } } });
  });
  return NextResponse.json({ ok: true });
}
