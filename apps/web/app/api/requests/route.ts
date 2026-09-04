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
  const title = optionalString(body?.title);
  if (!title) {
    return NextResponse.json({ error: "Informe um título para a demanda." }, { status: 400 });
  }

  const description = optionalString(body?.description);
  const requesterName = optionalString(body?.requesterName);
  const clientId = optionalString(body?.clientId);

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.request.create({
      data: {
        agencyId: membership.agencyId,
        clientId,
        title,
        description,
        requesterName,
        requestedByUserId: session.user.id,
      },
    });
    await tx.requestStatusHistory.create({
      data: { requestId: req.id, toStatus: "NOVA", actorUserId: session.user.id },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "request.created",
        resourceType: "request",
        resourceId: req.id,
      },
    });
    return req;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
