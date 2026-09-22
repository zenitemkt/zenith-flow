import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Editar título, descrição e prazo de uma tarefa já criada. Aberto a
 * qualquer membro da equipe (mesmo critério de checklist/comentários —
 * ver docs/DECISIONS.md, 2026-09-07: a restrição de "só quem está na vez"
 * vale para mover/avançar status, não para manter os dados corretos).
 */
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

  const task = await prisma.task.findUnique({ where: { id: params.id }, include: { project: true } });
  if (!task || task.project.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: { title?: string; description?: string | null; dueDate?: Date | null } = {};

  if (body?.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "O título não pode ficar vazio." }, { status: 400 });
    }
    data.title = title;
  }

  if (body?.description !== undefined) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    data.description = description || null;
  }

  if (body?.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") {
      data.dueDate = null;
    } else {
      const parsed = new Date(body.dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Prazo inválido." }, { status: 400 });
      }
      data.dueDate = parsed;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  await prisma.task.update({ where: { id: task.id }, data });

  return NextResponse.json({ ok: true });
}
