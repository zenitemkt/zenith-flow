import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { prisma, type MembershipRole, type MembershipStatus } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

const EDITABLE_ROLES: MembershipRole[] = ["AGENCY_ADMIN", "MANAGER", "ANALYST", "FINANCE", "HR"];
const ADMIN_ROLES: MembershipRole[] = ["SUPER_ADMIN", "AGENCY_ADMIN"];

async function authorizeTeamManagement() {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) } as const;
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return { error: NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 }) } as const;
  }
  if (isClientRole(membership.role)) {
    return { error: NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 }) } as const;
  }
  if (!canManageTeam(membership.role)) {
    return {
      error: NextResponse.json({ error: "Seu papel não tem permissão para gerenciar membros." }, { status: 403 }),
    } as const;
  }
  return { session, membership } as const;
}

/** Impede remover o único admin ativo restante da agência (auto-inativação, exclusão ou perda do papel de admin). */
async function wouldRemoveLastActiveAdmin(agencyId: string, target: { id: string; role: MembershipRole; status: MembershipStatus }) {
  if (!ADMIN_ROLES.includes(target.role) || target.status !== "ACTIVE") return false;
  const otherActiveAdmins = await prisma.membership.count({
    where: { agencyId, role: { in: ADMIN_ROLES }, status: "ACTIVE", id: { not: target.id } },
  });
  return otherActiveAdmins === 0;
}

/** Editar papel e/ou (in)ativar acesso — nunca a própria conta, nunca o último admin ativo da agência. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await authorizeTeamManagement();
  if ("error" in auth) return auth.error;
  const { session, membership } = auth;

  const target = await prisma.membership.findUnique({ where: { id: params.id } });
  if (!target || target.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const nextRole = body?.role as MembershipRole | undefined;
  const nextStatus = body?.status as MembershipStatus | undefined;

  if (nextRole === undefined && nextStatus === undefined) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }
  if (nextRole !== undefined && !EDITABLE_ROLES.includes(nextRole)) {
    return NextResponse.json({ error: "Papel inválido." }, { status: 400 });
  }
  if (nextStatus !== undefined && nextStatus !== "ACTIVE" && nextStatus !== "SUSPENDED") {
    return NextResponse.json({ error: "Status inválido para esta ação." }, { status: 400 });
  }
  if (nextStatus !== undefined && target.status !== "ACTIVE" && target.status !== "SUSPENDED") {
    return NextResponse.json(
      { error: "Convite pendente ou expirado não pode ser (in)ativado — cancele o convite." },
      { status: 400 },
    );
  }

  const isSelf = target.userId === session.user.id;
  if (isSelf && nextStatus === "SUSPENDED") {
    return NextResponse.json({ error: "Você não pode inativar seu próprio acesso." }, { status: 400 });
  }
  if (isSelf && nextRole !== undefined && nextRole !== target.role) {
    return NextResponse.json({ error: "Você não pode alterar seu próprio papel." }, { status: 400 });
  }

  const willSuspend = nextStatus === "SUSPENDED";
  const willLoseAdmin = nextRole !== undefined && !ADMIN_ROLES.includes(nextRole);
  if (willSuspend || willLoseAdmin) {
    const wouldOrphanAgency = await wouldRemoveLastActiveAdmin(membership.agencyId, target);
    if (wouldOrphanAgency) {
      return NextResponse.json(
        { error: "Precisa haver ao menos um admin ativo na agência." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.membership.update({
    where: { id: target.id },
    data: {
      ...(nextRole !== undefined ? { role: nextRole } : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "membership.updated",
      resourceType: "membership",
      resourceId: target.id,
      metadata: {
        from: { role: target.role, status: target.status },
        to: { role: updated.role, status: updated.status },
      },
    },
  });

  return NextResponse.json({ ok: true, role: updated.role, status: updated.status });
}

/** Exclui o cadastro (membership) — nunca a própria conta, nunca o último admin ativo da agência. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await authorizeTeamManagement();
  if ("error" in auth) return auth.error;
  const { session, membership } = auth;

  const target = await prisma.membership.findUnique({ where: { id: params.id } });
  if (!target || target.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Membro não encontrado." }, { status: 404 });
  }

  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "Você não pode excluir seu próprio cadastro." }, { status: 400 });
  }

  const wouldOrphanAgency = await wouldRemoveLastActiveAdmin(membership.agencyId, target);
  if (wouldOrphanAgency) {
    return NextResponse.json({ error: "Precisa haver ao menos um admin ativo na agência." }, { status: 400 });
  }

  await prisma.membership.delete({ where: { id: target.id } });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "membership.removed",
      resourceType: "membership",
      resourceId: target.id,
      metadata: { email: target.email, role: target.role, status: target.status },
    },
  });

  return NextResponse.json({ ok: true });
}
