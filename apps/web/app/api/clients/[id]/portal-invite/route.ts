import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type MembershipRole } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const PORTAL_ROLES: MembershipRole[] = ["CLIENT_ADMIN", "CLIENT_VIEWER"];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  if (!client.workspaceId) {
    return NextResponse.json(
      { error: "O cliente precisa estar Ativo para ter acesso ao portal." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = (body?.role as MembershipRole | undefined) ?? "CLIENT_VIEWER";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (!PORTAL_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }

  const existing = await prisma.membership.findUnique({
    where: { workspaceId_email: { workspaceId: client.workspaceId, email } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Este e-mail já tem acesso ou convite pendente ao portal." },
      { status: 409 },
    );
  }

  const inviteToken = randomUUID();
  const created = await prisma.membership.create({
    data: {
      email,
      agencyId: client.agencyId,
      workspaceId: client.workspaceId,
      role,
      status: "INVITED",
      invitedByUserId: session.user.id,
      inviteToken,
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: client.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "portal.invited",
      resourceType: "membership",
      resourceId: created.id,
      metadata: { clientId: client.id, email, role },
    },
  });

  return NextResponse.json(
    { membershipId: created.id, inviteToken, inviteUrl: `/convite/${inviteToken}` },
    { status: 201 },
  );
}
