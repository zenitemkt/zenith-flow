import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { sendTeamInviteEmail, isEmailConfigured } from "@/lib/email";
import { normalizeWhatsappNumber, buildWhatsappLink, buildWhatsappMessage } from "@/lib/whatsapp";
import { prisma, type MembershipRole } from "@zenite-mkt/db";

const INVITABLE_ROLES: MembershipRole[] = ["AGENCY_ADMIN", "MANAGER", "ANALYST", "FINANCE", "HR"];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE_LABELS: Record<string, string> = {
  AGENCY_ADMIN: "Admin da Agência",
  MANAGER: "Gestor",
  ANALYST: "Analista",
  FINANCE: "Financeiro",
  HR: "RH",
};

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
  if (!canManageTeam(membership.role)) {
    return NextResponse.json(
      { error: "Seu papel não tem permissão para convidar membros." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role as MembershipRole | undefined;
  const phone = typeof body?.phone === "string" ? normalizeWhatsappNumber(body.phone) : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (!role || !INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }

  const existing = await prisma.membership.findUnique({
    where: { workspaceId_email: { workspaceId: membership.workspaceId, email } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Este e-mail já é membro ou já tem um convite pendente." },
      { status: 409 },
    );
  }

  const inviteToken = randomUUID();
  const created = await prisma.membership.create({
    data: {
      email,
      agencyId: membership.agencyId,
      workspaceId: membership.workspaceId,
      role,
      status: "INVITED",
      invitedByUserId: session.user.id,
      inviteToken,
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "membership.invited",
      resourceType: "membership",
      resourceId: created.id,
      metadata: { email, role },
    },
  });

  const inviteUrl = `/convite/${inviteToken}`;
  let emailSent = false;
  if (isEmailConfigured()) {
    try {
      await sendTeamInviteEmail({
        to: email,
        inviteUrl: `${new URL(request.url).origin}${inviteUrl}`,
        agencyName: membership.agency.name,
        roleLabel: ROLE_LABELS[role] ?? role,
      });
      emailSent = true;
    } catch {
      emailSent = false;
    }
  }

  const waLink = phone
    ? buildWhatsappLink(
        phone,
        buildWhatsappMessage(
          `Oi! Você foi convidado(a) pra entrar no time de ${membership.agency.name}:`,
          `${new URL(request.url).origin}${inviteUrl}`,
        ),
      )
    : null;

  return NextResponse.json(
    { membershipId: created.id, inviteToken, inviteUrl, emailSent, waLink },
    { status: 201 },
  );
}
