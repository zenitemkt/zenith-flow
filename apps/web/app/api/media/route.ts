import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { r2, R2_BUCKET } from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/media";
import { buildObjectKey } from "@/lib/media-server";
import { prisma } from "@zenite-mkt/db";

export async function POST(request: Request) {
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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const clientId = formData?.get("clientId");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 25MB." }, { status: 400 });
  }

  const resolvedClientId = typeof clientId === "string" && clientId ? clientId : null;
  if (resolvedClientId) {
    const client = await prisma.client.findUnique({ where: { id: resolvedClientId } });
    if (!client || client.agencyId !== membership.agencyId) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }
  }

  const key = buildObjectKey(membership.agencyId, file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
    }),
  );

  const asset = await prisma.mediaAsset.create({
    data: {
      agencyId: membership.agencyId,
      clientId: resolvedClientId,
      key,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      uploadedByUserId: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      agencyId: membership.agencyId,
      actorUserId: session.user.id,
      actorType: "user",
      action: "media_asset.uploaded",
      resourceType: "media_asset",
      resourceId: asset.id,
      metadata: { fileName: file.name, sizeBytes: file.size, clientId: resolvedClientId },
    },
  });

  return NextResponse.json({ id: asset.id }, { status: 201 });
}
