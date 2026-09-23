import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canManageTeam, isClientRole } from "@/lib/rbac";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/team";
import { sendTeamInviteEmail, EmailNotConfiguredError } from "@/lib/email";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string };
}

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
  if (!canManageTeam(membership.role)) {
    return NextResponse.json({ error: "Seu papel não tem permissão para convidar membros." }, { status: 403 });
  }

  const invite = await prisma.membership.findUnique({ where: { id: params.id } });
  if (!invite || invite.agencyId !== membership.agencyId || invite.status !== "INVITED" || !invite.email || !invite.inviteToken) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const publicUrl = `${new URL(request.url).origin}/convite/${invite.inviteToken}`;

  try {
    await sendTeamInviteEmail({
      to: invite.email,
      inviteUrl: publicUrl,
      agencyName: membership.agency.name,
      roleLabel: MEMBERSHIP_ROLE_LABELS[invite.role] ?? invite.role,
    });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o e-mail." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
