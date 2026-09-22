import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; versionId: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const version = await prisma.contentVersion.findUnique({
    where: { id: params.versionId },
    include: { approval: true },
  });
  if (!version || version.contentItemId !== item.id) {
    return NextResponse.json({ error: "Versão não encontrada." }, { status: 404 });
  }
  if (version.approval && version.approval.status !== "PENDENTE") {
    return NextResponse.json(
      { error: "O cliente já decidiu sobre esta versão — suba uma nova versão em vez de editar o link." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const assetUrl = typeof body?.assetUrl === "string" ? body.assetUrl.trim() || null : undefined;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : undefined;

  if (assetUrl === null) {
    return NextResponse.json({ error: "Informe o link do material." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.contentVersion.update({
      where: { id: version.id },
      data: {
        ...(assetUrl !== undefined ? { assetUrl } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.version_link_changed",
        resourceType: "content_version",
        resourceId: version.id,
        metadata: { contentItemId: item.id },
      },
    });
    return result;
  });

  return NextResponse.json({ id: updated.id });
}
