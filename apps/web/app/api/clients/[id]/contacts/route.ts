import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
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

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : null;
  const role = typeof body?.role === "string" && body.role.trim() ? body.role.trim() : "Geral";
  const isPrimary = Boolean(body?.isPrimary);

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do contato." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.clientContact.updateMany({
        where: { clientId: client.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    await tx.clientContact.create({
      data: { clientId: client.id, name, email, phone, role, isPrimary },
    });
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
