import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { createEmployeeRecord } from "@/lib/employees-create";
import { prisma } from "@zenite-mkt/db";

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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
  const name = optionalString(body?.name);
  if (!name) {
    return NextResponse.json({ error: "Informe o nome da pessoa." }, { status: 400 });
  }

  const email = optionalString(body?.email);
  const phone = optionalString(body?.phone);
  const role = optionalString(body?.role);
  const userId = optionalString(body?.userId);
  const positionId = optionalString(body?.positionId);

  if (userId) {
    const linkedMembership = await prisma.membership.findFirst({ where: { userId, agencyId: membership.agencyId } });
    if (!linkedMembership) {
      return NextResponse.json({ error: "Pessoa da equipe inválida." }, { status: 400 });
    }
    const existingEmployee = await prisma.employee.findUnique({ where: { userId } });
    if (existingEmployee) {
      return NextResponse.json({ error: "Esta pessoa já tem um cadastro de RH." }, { status: 409 });
    }
  }

  if (positionId) {
    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    }
  }

  const created = await prisma.$transaction((tx) =>
    createEmployeeRecord(
      { agencyId: membership.agencyId, userId, name, email, phone, role, positionId, actorUserId: session.user.id },
      tx,
    ),
  );

  return NextResponse.json({ id: created.id }, { status: 201 });
}
