import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session";
import { prisma } from "@zenith/db";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "Convite inválido." }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({ where: { inviteToken: token } });
  if (!membership || membership.status !== "INVITED") {
    return NextResponse.json({ error: "Este convite não é mais válido." }, { status: 410 });
  }
  if (membership.inviteExpiresAt && membership.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Este convite expirou." }, { status: 410 });
  }
  if (membership.email !== session.user.email) {
    return NextResponse.json(
      { error: "Este convite foi enviado para outro e-mail." },
      { status: 403 },
    );
  }

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membership.id },
      data: { userId: session.user.id, status: "ACTIVE", inviteToken: null },
    }),
    prisma.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "membership.accepted",
        resourceType: "membership",
        resourceId: membership.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
