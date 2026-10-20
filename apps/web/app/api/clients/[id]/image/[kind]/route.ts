import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { r2, R2_BUCKET } from "@/lib/r2";
import { CLIENT_IMAGE_MAX_BYTES, CLIENT_IMAGE_TYPES } from "@/lib/clients";
import { prisma } from "@zenite-mkt/db";

interface RouteParams {
  params: { id: string; kind: string };
}

const KINDS = ["avatar", "banner"] as const;
type ImageKind = (typeof KINDS)[number];

function parseKind(kind: string): ImageKind | null {
  return (KINDS as readonly string[]).includes(kind) ? (kind as ImageKind) : null;
}

const KEY_FIELD = { avatar: "avatarKey", banner: "bannerKey" } as const;

async function authorize(clientId: string) {
  const session = await getServerSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return { error: NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 }) };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, agencyId: true, workspaceId: true, avatarKey: true, bannerKey: true },
  });
  if (!client || client.agencyId !== membership.agencyId) {
    return { error: NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 }) };
  }
  return { session, membership, client };
}

/** Link estável da imagem — o bucket é privado, então redireciona pra uma URL assinada gerada na hora. */
export async function GET(_request: Request, { params }: RouteParams) {
  const kind = parseKind(params.kind);
  if (!kind) return NextResponse.json({ error: "Imagem inválida." }, { status: 404 });
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;

  if (isClientRole(auth.membership.role) && auth.client.workspaceId !== auth.membership.workspaceId) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  const key = auth.client[KEY_FIELD[kind]];
  if (!key) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });

  const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 300 });
  return NextResponse.redirect(url);
}

export async function POST(request: Request, { params }: RouteParams) {
  const kind = parseKind(params.kind);
  if (!kind) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;
  if (isClientRole(auth.membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  }
  if (!CLIENT_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Use uma imagem PNG, JPG, WEBP ou GIF." }, { status: 400 });
  }
  if (file.size > CLIENT_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "A imagem passa de 5MB." }, { status: 400 });
  }

  const key = `${auth.membership.agencyId}/clients/${auth.client.id}/${kind}-${randomUUID()}`;
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type,
    }),
  );

  const previousKey = auth.client[KEY_FIELD[kind]];
  await prisma.client.update({ where: { id: auth.client.id }, data: { [KEY_FIELD[kind]]: key } });
  if (previousKey) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: previousKey })).catch(() => undefined);
  }

  await prisma.auditLog.create({
    data: {
      agencyId: auth.membership.agencyId,
      actorUserId: auth.session.user.id,
      actorType: "user",
      action: `client.${kind}_updated`,
      resourceType: "client",
      resourceId: auth.client.id,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const kind = parseKind(params.kind);
  if (!kind) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  const auth = await authorize(params.id);
  if ("error" in auth) return auth.error;
  if (isClientRole(auth.membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const key = auth.client[KEY_FIELD[kind]];
  if (key) {
    await prisma.client.update({ where: { id: auth.client.id }, data: { [KEY_FIELD[kind]]: null } });
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
