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

  // Seção 17 do manual: "mudança após aprovação reabre aprovação quando campo
  // material mudar" — subir um material novo depois que o cliente já aprovou
  // (ou depois de agendado/publicado) invalida o que estava combinado e volta
  // o item pra produção, exigindo um novo envio/aprovação.
  const REOPENS_ON_NEW_VERSION = ["APROVADO", "AGENDADO", "PUBLICADO"] as const;
  const shouldReopen = REOPENS_ON_NEW_VERSION.includes(item.status as (typeof REOPENS_ON_NEW_VERSION)[number]);

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.contentVersion.create({
      data: {
        contentItemId: item.id,
        versionNumber,
        assetUrl,
        notes,
        createdByUserId: session.user.id,
      },
    });

    if (shouldReopen) {
      await tx.contentItem.update({ where: { id: item.id }, data: { status: "PRODUCAO" } });
      await tx.contentStatusHistory.create({
        data: {
          contentItemId: item.id,
          fromStatus: item.status,
          toStatus: "PRODUCAO",
          reason: "Material alterado após aprovação — aprovação anterior reaberta",
          actorUserId: session.user.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        agencyId: membership.agencyId,
        actorUserId: session.user.id,
        actorType: "user",
        action: "content.version_created",
        resourceType: "content_version",
        resourceId: created.id,
        metadata: { contentItemId: item.id, versionNumber, reopened: shouldReopen },
      },
    });

    return created;
  });

  return NextResponse.json({ id: version.id, versionNumber, reopened: shouldReopen }, { status: 201 });
}
