import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const template = await prisma.routineTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Rotina não encontrada." }, { status: 404 });
  }
  if (template.status !== "ATIVO") {
    return NextResponse.json({ error: "Só é possível pausar uma rotina ativa." }, { status: 400 });
  }

  // Pausar nunca apaga o trabalho já criado (seção 15 do manual) — só impede
  // novas gerações; runs e projetos existentes permanecem intactos.
  await prisma.routineTemplate.update({ where: { id: template.id }, data: { status: "PAUSADO" } });

  return NextResponse.json({ ok: true });
}
