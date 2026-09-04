import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { canTransitionRequest } from "@/lib/requests";
import { prisma, type RequestStatus, type RequestPriority } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const VALID_PRIORITIES: RequestPriority[] = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const existing = await prisma.request.findUnique({ where: { id: params.id } });
  if (!existing || existing.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Demanda não encontrada." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const toStatus = body?.toStatus as RequestStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
  const priority = body?.priority as RequestPriority | undefined;

  if (!toStatus || !canTransitionRequest(existing.status, toStatus)) {
    return NextResponse.json(
      { error: `Não é possível mudar de ${existing.status} para ${toStatus}.` },
      { status: 400 },
    );
  }
  if (toStatus === "REJEITADA" && !reason) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "Prioridade inválida." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: existing.id },
      data: {
        status: toStatus,
        priority: priority ?? existing.priority,
        rejectionReason: toStatus === "REJEITADA" ? reason : existing.rejectionReason,
      },
    });
    await tx.requestStatusHistory.create({
      data: {
        requestId: existing.id,
        fromStatus: existing.status,
        toStatus,
        reason,
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "request.status_changed",
        resourceType: "request",
        resourceId: existing.id,
        metadata: { from: existing.status, to: toStatus, reason },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
