import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { prisma, type MembershipRole } from "@zenite-mkt/db";

const INVITABLE_ROLES: MembershipRole[] = ["AGENCY_ADMIN", "MANAGER", "ANALYST", "FINANCE", "HR"];

/**
 * Cria o colaborador já com login/senha definidos pelo admin (em vez de link
 * de convite) — pedido do usuário, 2026-09-10: "definir seu login, senha e
 * cargo". Membership nasce ACTIVE (não INVITED), então a pessoa já aparece
 * de imediato como responsável selecionável em Operação (ver
 * `getAgencyMembers`, que filtra por `status: "ACTIVE"`).
 */
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
      { error: "Seu papel não tem permissão para criar colaboradores." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role as MembershipRole | undefined;

  if (!name) {
    return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (!role || !INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }

  const existingMembership = await prisma.membership.findUnique({
    where: { workspaceId_email: { workspaceId: membership.workspaceId, email } },
  });
  if (existingMembership) {
    return NextResponse.json(
      { error: "Este e-mail já é membro ou já tem um convite pendente." },
      { status: 409 },
    );
  }

  let userId: string;
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Conta já existe (ex.: pessoa já é membro de outra agência) — só vincula
    // o acesso a esta agência, nunca mexe na senha de uma conta alheia.
    userId = existingUser.id;
  } else {
    const signUpResult = await auth.api.signUpEmail({ body: { name, email, password } });
    userId = signUpResult.user.id;
  }

  const created = await prisma.membership.create({
    data: {
      userId,
      email,
      agencyId: membership.agencyId,
      workspaceId: membership.workspaceId,
      role,
      status: "ACTIVE",
      invitedByUserId: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "membership.created_direct",
      resourceType: "membership",
      resourceId: created.id,
      metadata: { email, role },
    },
  });

  return NextResponse.json({ membershipId: created.id }, { status: 201 });
}
