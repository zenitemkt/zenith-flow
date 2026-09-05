import { NextResponse } from "next/server";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { r2, R2_BUCKET } from "@/lib/r2";
import { prisma } from "@zenith/db";

interface RouteParams {
  params: { id: string };
}

/**
 * Link estável de download — o objeto no R2 é privado, então em vez de
 * guardar/mostrar uma URL assinada (que expira), redirecionamos pra uma
 * gerada na hora. `/api/media/:id` nunca muda; o destino do redirect sim.
 */
export async function GET(_request: Request, { params }: RouteParams) {
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

  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: asset.key,
      ResponseContentDisposition: `inline; filename="${asset.fileName}"`,
    }),
    { expiresIn: 300 },
  );

  return NextResponse.redirect(url);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset || asset.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: asset.key }));
  await prisma.mediaAsset.delete({ where: { id: asset.id } });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "media_asset.deleted",
      resourceType: "media_asset",
      resourceId: asset.id,
      metadata: { fileName: asset.fileName },
    },
  });

  return NextResponse.json({ ok: true });
}
