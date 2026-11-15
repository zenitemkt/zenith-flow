import { NextResponse } from "next/server";
import { prisma } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { createDriveResumableUpload } from "@/lib/google-drive";
import { agencyHasDriveUser, withAgencyDrive } from "@/lib/drive-auth";
import { validateContentMediaFile } from "@/lib/content-media";
import { SocialDriveNotReady, ensureSocialDriveFolders } from "@/lib/social-drive";

/**
 * Envio da mídia de uma publicação direto para o Drive (pasta "1 - Programados"): devolve a URL
 * de envio retomável; o navegador sobe o arquivo e recebe o id do Drive. 409 = Drive não
 * conectado (o formulário cai no envio antigo para o R2).
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const contentId = typeof body?.contentId === "string" ? body.contentId : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  const size = Number(body?.sizeBytes);
  const item = await prisma.contentItem.findFirst({ where: { id: contentId, agencyId: membership.agencyId }, select: { id: true, title: true } });
  if (!item) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  const invalid = validateContentMediaFile({ name: fileName, type: contentType, size });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (!(await agencyHasDriveUser(membership.agencyId))) return NextResponse.json({ error: "Drive não conectado." }, { status: 409 });
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  try {
    const uploadUrl = await withAgencyDrive(membership.agencyId, async () => {
      const folders = await ensureSocialDriveFolders(membership.agencyId);
      const day = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
      return createDriveResumableUpload({ name: `${day} ${item.title}`.slice(0, 120) + ` - ${fileName}`, mimeType: contentType, size, parentId: folders.scheduledId, origin });
    });
    return NextResponse.json({ uploadUrl });
  } catch (error) {
    if (error instanceof SocialDriveNotReady) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui preparar o envio ao Drive." }, { status: 502 });
  }
}
