import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

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
  const role = optionalString(body?.role);
  const userId = optionalString(body?.userId);

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

  const created = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        agencyId: membership.agencyId,
        userId,
        name,
        email,
        role,
        hiredAt: new Date(),
      },
    });
    await tx.employeeStatusHistory.create({
      data: { employeeId: employee.id, toStatus: "ATIVO", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "employee.created",
        resourceType: "employee",
        resourceId: employee.id,
      },
    });
    return employee;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
