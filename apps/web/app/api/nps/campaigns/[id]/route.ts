import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

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
