import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/** Pausar nunca apaga o trabalho já gerado — só impede novas gerações. */
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

  const template = await prisma.recurringTaskTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Recorrência não encontrada." }, { status: 404 });
  }
  if (template.status !== "ATIVO") {
    return NextResponse.json({ error: "Só é possível pausar recorrências ativas." }, { status: 400 });
  }

  await prisma.recurringTaskTemplate.update({ where: { id: template.id }, data: { status: "PAUSADO" } });

  return NextResponse.json({ ok: true });
}
