import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma, type MembershipRole } from "@zenite-mkt/db";

const PORTAL_ROLES: MembershipRole[] = ["CLIENT_ADMIN", "CLIENT_VIEWER"];

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
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }

  const document = optionalString(body?.document);
  const email = optionalString(body?.email);
  const phone = optionalString(body?.phone);
  const whatsapp = optionalString(body?.whatsapp);
  const responsavelNome = optionalString(body?.responsavelNome);
  const responsavelEmail = optionalString(body?.responsavelEmail);
  const responsavelTelefone = optionalString(body?.responsavelTelefone);

  const portalEmail = optionalString(body?.portalEmail)?.toLowerCase() ?? null;
  const portalPassword = typeof body?.portalPassword === "string" ? body.portalPassword : "";
  const portalRole = (body?.portalRole as MembershipRole | undefined) ?? "CLIENT_VIEWER";

  if (portalEmail) {
    if (!portalEmail.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail de acesso válido." }, { status: 400 });
    }
    if (portalPassword.length < 8) {
      return NextResponse.json(
        { error: "A senha de acesso do cliente precisa ter pelo menos 8 caracteres." },
        { status: 400 },
      );
    }
    if (!PORTAL_ROLES.includes(portalRole)) {
      return NextResponse.json({ error: "Papel de portal inválido." }, { status: 400 });
    }
  }

  // `auth.api.signUpEmail` grava em tabelas próprias (User/Account) fora da
  // transação principal — precisa rodar antes, nunca dentro do `$transaction`.
  let portalUserId: string | null = null;
  if (portalEmail) {
    const existingUser = await prisma.user.findUnique({ where: { email: portalEmail } });
    if (existingUser) {
      portalUserId = existingUser.id;
    } else {
      const signUpResult = await auth.api.signUpEmail({
        body: { name: responsavelNome || name, email: portalEmail, password: portalPassword },
      });
      portalUserId = signUpResult.user.id;
    }
  }

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

    if (portalEmail && portalUserId) {
      const workspace = await tx.workspace.create({
        data: { agencyId: membership.agencyId, name: created.name, kind: "CLIENT" },
      });
      await tx.client.update({ where: { id: created.id }, data: { workspaceId: workspace.id } });
      await tx.membership.create({
        data: {
          userId: portalUserId,
          email: portalEmail,
          agencyId: membership.agencyId,
          workspaceId: workspace.id,
          role: portalRole,
          status: "ACTIVE",
          invitedByUserId: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          agencyId: membership.agencyId,
          actorUserId: session.user.id,
          actorType: "user",
          action: "portal.created_direct",
          resourceType: "client",
          resourceId: created.id,
          metadata: { email: portalEmail, role: portalRole },
        },
      });
    }

    return created;
  });

  return NextResponse.json({ id: client.id }, { status: 201 });
}
