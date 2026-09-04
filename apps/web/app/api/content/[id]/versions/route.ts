import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { prisma } from "@zenith/db";

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

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const assetUrl = typeof body?.assetUrl === "string" ? body.assetUrl.trim() || null : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!assetUrl) {
    return NextResponse.json({ error: "Informe o link do material (Drive, Figma, Canva...)." }, { status: 400 });
  }

  const lastVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId: item.id },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  const version = await prisma.contentVersion.create({
    data: {
      contentItemId: item.id,
      versionNumber,
      assetUrl,
      notes,
      createdByUserId: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "content.version_created",
      resourceType: "content_version",
      resourceId: version.id,
      metadata: { contentItemId: item.id, versionNumber },
    },
  });

  return NextResponse.json({ id: version.id, versionNumber }, { status: 201 });
}
