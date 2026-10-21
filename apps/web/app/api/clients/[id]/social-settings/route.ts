import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";

interface RouteParams {
  params: { id: string };
}

/** Liga/desliga o agendamento automático ao aprovar e o horário padrão de publicação do cliente. */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }
  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const data: { autoScheduleOnApproval?: boolean; defaultPublishTime?: string } = {};
  if (typeof body?.autoScheduleOnApproval === "boolean") data.autoScheduleOnApproval = body.autoScheduleOnApproval;
  if (typeof body?.defaultPublishTime === "string") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.defaultPublishTime)) {
      return NextResponse.json({ error: "Horário inválido (use HH:MM)." }, { status: 400 });
    }
    data.defaultPublishTime = body.defaultPublishTime;
  }

  await prisma.client.update({ where: { id: client.id }, data });
  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "client.social_settings_updated",
      resourceType: "client",
      resourceId: client.id,
      metadata: data,
    },
  });
  return NextResponse.json({ ok: true });
}
