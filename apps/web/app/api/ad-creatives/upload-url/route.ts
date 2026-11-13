import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { createDriveResumableUpload } from "@/lib/google-drive";
import { IMAGE_TYPES, VIDEO_TYPES } from "@/lib/ad-creatives";
import { agencyHasDriveUser, withAgencyDrive } from "@/lib/drive-auth";

const IMAGE_MAX = 30 * 1024 * 1024;
const VIDEO_MAX = 4 * 1024 * 1024 * 1024;

/**
 * Envio pelo portal: devolve o endereço para o navegador mandar o arquivo direto para a subpasta
 * "1 - Para subir" do Drive. Depois a tela chama /api/ad-creatives/sync e o criativo aparece.
 */
export async function POST(request: Request) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const size = Number(body?.size);
  if (!fileName || !Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  const isImage = IMAGE_TYPES.includes(mimeType);
  const isVideo = VIDEO_TYPES.includes(mimeType);
  if (!isImage && !isVideo) return NextResponse.json({ error: `${fileName}: use JPG, PNG, MP4 ou MOV.` }, { status: 400 });
  if ((isImage && size > IMAGE_MAX) || (isVideo && size > VIDEO_MAX)) return NextResponse.json({ error: `${fileName}: arquivo grande demais (imagem até 30 MB, vídeo até 4 GB).` }, { status: 400 });

  const folder = await prisma.adCreativeFolder.findFirst({
    where: { agencyId: membership.agencyId, ...(typeof body?.folderId === "string" && body.folderId ? { id: body.folderId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  if (!folder) return NextResponse.json({ error: "Conecte uma pasta do Drive antes de enviar." }, { status: 400 });

  if (!(await agencyHasDriveUser(membership.agencyId))) {
    return NextResponse.json({ error: "Para enviar pelo portal, conecte a sua conta Google (botão no quadro Google Drive)." }, { status: 400 });
  }
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  try {
    const uploadUrl = await withAgencyDrive(membership.agencyId, () => createDriveResumableUpload({ name: fileName, mimeType, size, parentId: folder.inboxFolderId, origin }));
    return NextResponse.json({ uploadUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui preparar o envio." }, { status: 502 });
  }
}
