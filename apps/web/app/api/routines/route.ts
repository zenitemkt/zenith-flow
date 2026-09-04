import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { prisma } from "@zenith/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const clientId = typeof body?.clientId === "string" && body.clientId ? body.clientId : null;
  const dayOfMonth = Number(body?.dayOfMonth);
  const taskTitles: string[] = Array.isArray(body?.taskTitles)
    ? body.taskTitles.filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim())
    : [];

  if (!name) {
    return NextResponse.json({ error: "Informe o nome da rotina." }, { status: 400 });
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    return NextResponse.json({ error: "Dia do mês deve ser entre 1 e 28." }, { status: 400 });
  }
  if (taskTitles.length === 0) {
    return NextResponse.json({ error: "Adicione pelo menos uma tarefa recorrente." }, { status: 400 });
  }

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
  }

  const template = await prisma.routineTemplate.create({
    data: {
      agencyId: membership.agencyId,
      clientId,
      name,
      dayOfMonth,
      tasks: {
        create: taskTitles.map((title, index) => ({ title, order: index })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "routine.created",
      resourceType: "routine_template",
      resourceId: template.id,
    },
  });

  return NextResponse.json({ id: template.id }, { status: 201 });
}
