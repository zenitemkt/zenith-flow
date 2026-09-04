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
    return NextResponse.json({ error: "Informe o nome do fornecedor." }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      agencyId: membership.agencyId,
      name,
      category: optionalString(body?.category),
      contactEmail: optionalString(body?.contactEmail),
      contactPhone: optionalString(body?.contactPhone),
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "vendor.created",
      resourceType: "vendor",
      resourceId: vendor.id,
    },
  });

  return NextResponse.json({ id: vendor.id }, { status: 201 });
}
