import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
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

  const body = await request.json().catch(() => null);
  const name = optionalString(body?.name);
  if (!name) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }

  const document = optionalString(body?.document);
  const email = optionalString(body?.email);
  const phone = optionalString(body?.phone);
  const whatsapp = optionalString(body?.whatsapp);
  const responsavelNome = optionalString(body?.responsavelNome);
  const responsavelEmail = optionalString(body?.responsavelEmail);
  const responsavelTelefone = optionalString(body?.responsavelTelefone);

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: { agencyId: membership.agencyId, name, document, email, phone, whatsapp },
    });
    await tx.clientStatusHistory.create({
      data: { clientId: created.id, toStatus: "PROSPECT", actorUserId: session.user.id },
    });
    if (responsavelNome) {
      await tx.clientContact.create({
        data: {
          clientId: created.id,
          name: responsavelNome,
          email: responsavelEmail,
          phone: responsavelTelefone,
          role: "Responsável",
          isPrimary: true,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "client.created",
        resourceType: "client",
        resourceId: created.id,
      },
    });
    return created;
  });

  return NextResponse.json({ id: client.id }, { status: 201 });
}
