import { prisma } from "@zenite-mkt/db";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET } from "@/lib/r2";
import { createDriveFolder, downloadDriveFile, getDriveFile, moveDriveFile } from "@/lib/google-drive";
import { putContentMedia, signContentMediaRead } from "@/lib/content-media-server";

/**
 * Mídias das publicações no Drive compartilhado (mesmo Drive dos criativos do Gestor de tráfego):
 * pasta "Publicações (Zenite Flow)" com "1 - Programados", "2 - Publicados" e "3 - Falhas".
 * O arquivo nasce em Programados e é movido sozinho ao publicar ou falhar. Na hora de publicar,
 * uma cópia temporária vai para o R2 só para a Meta baixar, e é apagada depois.
 * Chamar dentro de `withAgencyDrive` (usa a conta Google da agência).
 */
export const DRIVE_KEY_PREFIX = "drive:";
export const driveIdOfKey = (key: string | null | undefined) => (key?.startsWith(DRIVE_KEY_PREFIX) ? key.slice(DRIVE_KEY_PREFIX.length) : null);

export class SocialDriveNotReady extends Error {}

export async function ensureSocialDriveFolders(agencyId: string) {
  const existing = await prisma.socialDriveFolder.findUnique({ where: { agencyId } });
  if (existing) return existing;
  const creatives = await prisma.adCreativeFolder.findFirst({ where: { agencyId }, orderBy: { createdAt: "asc" } });
  if (!creatives) throw new SocialDriveNotReady("Conecte a pasta do Drive no Gestor de tráfego (aba Criativos) para guardar as mídias das publicações.");
  // Fica ao lado da pasta dos criativos, dentro do mesmo Drive compartilhado.
  const parent = (await getDriveFile(creatives.rootFolderId)).parents?.[0] ?? creatives.rootFolderId;
  const root = await createDriveFolder("Publicações (Zenite Flow)", parent);
  const [scheduled, published, failed] = await Promise.all([createDriveFolder("1 - Programados", root.id), createDriveFolder("2 - Publicados", root.id), createDriveFolder("3 - Falhas", root.id)]);
  return prisma.socialDriveFolder.create({ data: { agencyId, rootId: root.id, scheduledId: scheduled.id, publishedId: published.id, failedId: failed.id } });
}

/** Move os arquivos para Publicados ou Falhas (de onde estiverem: Programados ou Falhas). */
export async function moveSocialDriveFiles(agencyId: string, fileIds: string[], to: "published" | "failed" | "scheduled") {
  if (!fileIds.length) return;
  const folders = await prisma.socialDriveFolder.findUnique({ where: { agencyId } });
  if (!folders) return;
  const target = to === "published" ? folders.publishedId : to === "failed" ? folders.failedId : folders.scheduledId;
  for (const id of Array.from(new Set(fileIds))) {
    const file = await getDriveFile(id).catch(() => null);
    const from = file?.parents?.find((p) => p !== target && [folders.scheduledId, folders.publishedId, folders.failedId].includes(p));
    if (from) await moveDriveFile(id, from, target).catch((error) => console.error("social_drive_move_failed", id, error));
  }
}

const tempKey = (postId: string, driveFileId: string) => `tmp/social/${postId}/${driveFileId}`;

/** Copia o arquivo do Drive para o R2 (temporário) e devolve um link que a Meta consegue baixar. */
export async function publicUrlForDriveFile(postId: string, driveFileId: string, contentType: string): Promise<string> {
  const key = tempKey(postId, driveFileId);
  const body = new Uint8Array(await (await downloadDriveFile(driveFileId)).arrayBuffer());
  await putContentMedia(key, body, contentType);
  return signContentMediaRead(key, 2 * 60 * 60);
}

/** Apaga as cópias temporárias da publicação (depois de publicar ou falhar de vez). */
export async function deleteTempCopies(postId: string, driveFileIds: string[]) {
  for (const id of driveFileIds) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: tempKey(postId, id) })).catch(() => undefined);
  }
}

/** Abre na tela um arquivo de publicação guardado no Drive (pré-visualização e aprovação do cliente). */
export async function driveMediaResponse(agencyId: string, driveFileId: string, contentType: string): Promise<Response> {
  const { withAgencyDrive } = await import("@/lib/drive-auth");
  const upstream = await withAgencyDrive(agencyId, () => downloadDriveFile(driveFileId));
  return new Response(upstream.body, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=300" } });
}
