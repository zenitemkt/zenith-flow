import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { findTriggerEvent } from "@/lib/workflows";
import { prisma } from "@zenith/db";

/** Cria um workflow em rascunho (seção 40) — nasce sem passos, editados depois em /automacoes/:id. */
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const triggerEvent = typeof body?.triggerEvent === "string" ? body.triggerEvent : "";

  if (!name) {
    return NextResponse.json({ error: "Dê um nome à automação." }, { status: 400 });
  }
  if (!findTriggerEvent(triggerEvent)) {
    return NextResponse.json({ error: "Escolha um gatilho válido." }, { status: 400 });
  }

  const workflow = await prisma.workflow.create({
    data: { agencyId: membership.agencyId, name, triggerEvent, createdByUserId: session.user.id },
  });

  return NextResponse.json({ id: workflow.id }, { status: 201 });
}
