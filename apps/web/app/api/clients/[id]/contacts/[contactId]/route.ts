import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; contactId: string };
}

async function loadContact(clientId: string, contactId: string, agencyId: string) {
  const contact = await prisma.clientContact.findUnique({ where: { id: contactId }, include: { client: true } });
  if (!contact || contact.clientId !== clientId || contact.client.agencyId !== agencyId) return null;
  return contact;
}

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

  const contact = await loadContact(params.id, params.contactId, membership.agencyId);
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() || null : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : null;
  const role = typeof body?.role === "string" && body.role.trim() ? body.role.trim() : "Geral";
  const isPrimary = Boolean(body?.isPrimary);

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do contato." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (isPrimary && !contact.isPrimary) {
      await tx.clientContact.updateMany({
        where: { clientId: contact.clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    await tx.clientContact.update({
      where: { id: contact.id },
      data: { name, email, phone, role, isPrimary },
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const contact = await loadContact(params.id, params.contactId, membership.agencyId);
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  await prisma.clientContact.delete({ where: { id: contact.id } });

  return NextResponse.json({ ok: true });
}
