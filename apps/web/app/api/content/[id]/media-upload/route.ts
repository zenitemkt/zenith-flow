import { NextResponse } from "next/server";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";
import { DIRECT_UPLOAD_THRESHOLD_BYTES, validateContentMediaFile } from "@/lib/content-media";
import { buildContentMediaKey, putContentMedia, signContentMediaUpload } from "@/lib/content-media-server";

interface RouteParams {
  params: { id: string };
}

/**
 * Sobe um arquivo da arte antes de criar a versão. Dois modos:
 * - multipart com `file` (até ~4MB): o servidor grava no R2;
 * - JSON `{ fileName, contentType, sizeBytes }`: devolve URL assinada pro
 *   navegador subir direto (vídeos/arquivos grandes — exige CORS no bucket).
 * Em ambos devolve a `key`, que vai junto no POST de /versions.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership) return NextResponse.json({ error: "Você não pertence a uma agência." }, { status: 403 });
  if (isClientRole(membership.role)) {
    return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  }

  const item = await prisma.contentItem.findUnique({ where: { id: params.id }, select: { id: true, agencyId: true } });
  if (!item || item.agencyId !== membership.agencyId) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }

  const contentTypeHeader = request.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Envie um arquivo." }, { status: 400 });
    }
    const invalid = validateContentMediaFile(file);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    if (file.size > DIRECT_UPLOAD_THRESHOLD_BYTES) {
      return NextResponse.json({ error: "Arquivo grande demais para este modo." }, { status: 413 });
    }
    const key = buildContentMediaKey(item.agencyId, item.id, file.name);
    await putContentMedia(key, new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json({ key });
  }

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const sizeBytes = Number(body?.sizeBytes);
  const invalid = validateContentMediaFile({ name: fileName || "arquivo", type: contentType, size: sizeBytes });
  if (!fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || invalid) {
    return NextResponse.json({ error: invalid ?? "Arquivo inválido." }, { status: 400 });
  }

  const key = buildContentMediaKey(item.agencyId, item.id, fileName);
  const uploadUrl = await signContentMediaUpload(key, contentType);
  return NextResponse.json({ key, uploadUrl });
}
