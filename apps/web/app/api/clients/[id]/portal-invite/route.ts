import { syncClientDriveAccess, updateClientDriveRole } from "@/lib/client-drive";
import { agencyHasDriveUser, withAgencyDrive } from "@/lib/drive-auth";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type MembershipRole } from "@zenite-mkt/db";
import { canSeeClient } from "@/lib/client-access";

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
  if (!client || client.agencyId !== membership.agencyId || !(await canSeeClient(membership.agencyId, session.user.id, client.id))) {
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

  // Pasta do cliente no Drive: cria se faltar e dá acesso de editor aos e-mails do cliente.
  if (await agencyHasDriveUser(membership.agencyId).catch(() => false)) {
    await withAgencyDrive(membership.agencyId, () => syncClientDriveAccess(membership.agencyId, client.id)).catch((error) => console.error("client_drive_sync_failed", error));
  }
  return NextResponse.json(
    { membershipId: created.id, inviteToken, inviteUrl: `/convite/${inviteToken}` },
    { status: 201 },
  );
}

/** Troca o papel de quem já tem acesso ao portal (e ajusta a pasta do Drive). */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId || !client.workspaceId || !(await canSeeClient(membership.agencyId, session.user.id, client.id))) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const role = body?.role === "CLIENT_ADMIN" || body?.role === "CLIENT_VIEWER" ? (body.role as "CLIENT_ADMIN" | "CLIENT_VIEWER") : null;
  if (!role || typeof body?.membershipId !== "string") return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  const member = await prisma.membership.findFirst({ where: { id: body.membershipId, workspaceId: client.workspaceId, role: { in: ["CLIENT_ADMIN", "CLIENT_VIEWER"] } } });
  if (!member) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  await prisma.membership.update({ where: { id: member.id }, data: { role } });
  await prisma.auditLog.create({
    data: { agencyId: membership.agencyId, actorUserId: session.user.id, actorType: "user", action: "portal.role_changed", resourceType: "membership", resourceId: member.id, metadata: { clientId: client.id, from: member.role, to: role } },
  });
  if (await agencyHasDriveUser(membership.agencyId).catch(() => false)) {
    await withAgencyDrive(membership.agencyId, () => updateClientDriveRole(client.id, member.email, role)).catch((error) => console.error("client_drive_role_failed", error));
  }
  return NextResponse.json({ ok: true });
}
