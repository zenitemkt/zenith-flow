import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canTransition } from "@/lib/clients";
import { prisma, type ClientStatus } from "@zenith/db";

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

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client || client.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as ClientStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  if (!toStatus || !canTransition(client.status, toStatus)) {
    return NextResponse.json(
      { error: `Não é possível mudar de ${client.status} para ${toStatus}.` },
      { status: 400 },
    );
  }
  if ((toStatus === "PAUSADO" || toStatus === "EM_ENCERRAMENTO") && !reason) {
    return NextResponse.json(
      { error: "Informe o motivo para esta mudança de status." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id: client.id }, data: { status: toStatus } });
    await tx.clientStatusHistory.create({
      data: {
        clientId: client.id,
        fromStatus: client.status,
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });

    if (toStatus === "ONBOARDING") {
      const existingRun = await tx.onboardingRun.findFirst({ where: { clientId: client.id } });
      if (!existingRun) {
        const template = await tx.onboardingTemplate.findFirst({
          where: { agencyId: membership.agencyId },
          include: { items: { orderBy: { order: "asc" } } },
        });
        await tx.onboardingRun.create({
          data: {
            clientId: client.id,
            templateId: template?.id,
            items: {
              create: (template?.items ?? []).map((item) => ({
                title: item.title,
                description: item.description,
                order: item.order,
                status: item.order === 0 ? "PENDENTE" : "BLOQUEADO",
              })),
            },
          },
        });
      }
    }

    if (toStatus === "ATIVO" && !client.workspaceId) {
      const workspace = await tx.workspace.create({
        data: { agencyId: membership.agencyId, name: client.name, kind: "CLIENT" },
      });
      await tx.client.update({ where: { id: client.id }, data: { workspaceId: workspace.id } });
    }

    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "client.status_changed",
        resourceType: "client",
        resourceId: client.id,
        metadata: { from: client.status, to: toStatus, reason },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
