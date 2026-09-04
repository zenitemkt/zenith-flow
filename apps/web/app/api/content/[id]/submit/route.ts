import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { SUBMITTABLE_STATUSES } from "@/lib/content";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

const APPROVAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }
  if (!SUBMITTABLE_STATUSES.includes(item.status)) {
    return NextResponse.json(
      { error: "Só é possível enviar para aprovação a partir de revisão interna ou ajustes." },
      { status: 400 },
    );
  }

  const latestVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId: item.id },
    orderBy: { versionNumber: "desc" },
  });
  if (!latestVersion) {
    return NextResponse.json(
      { error: "Adicione uma versão com o material antes de enviar para aprovação." },
      { status: 400 },
    );
  }

  const existingApproval = await prisma.contentApproval.findUnique({
    where: { contentVersionId: latestVersion.id },
  });
  if (existingApproval) {
    return NextResponse.json(
      { error: "Esta versão já foi enviada para aprovação." },
      { status: 409 },
    );
  }

  const token = randomUUID();
  const result = await prisma.$transaction(async (tx) => {
    await tx.contentApproval.create({
      data: {
        contentVersionId: latestVersion.id,
        token,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      },
    });
    await tx.contentItem.update({ where: { id: item.id }, data: { status: "AGUARDANDO_CLIENTE" } });
    await tx.contentStatusHistory.create({
      data: {
        contentItemId: item.id,
        fromStatus: item.status,
        toStatus: "AGUARDANDO_CLIENTE",
        actorUserId: session.user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.submitted",
        resourceType: "content_item",
        resourceId: item.id,
        metadata: { versionId: latestVersion.id, versionNumber: latestVersion.versionNumber },
      },
    });
    return { token };
  });

  return NextResponse.json({ approvalUrl: `/aprovar/${result.token}` }, { status: 201 });
}
