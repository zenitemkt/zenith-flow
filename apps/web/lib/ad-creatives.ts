import { prisma } from "@zenite-mkt/db";
import type { AdCreativeFolder, AdCreativeStatus } from "@prisma/client";
import { createDriveFolder, getDriveFile, isDriveFolder, listDriveChildren, moveDriveFile, type DriveFile } from "@/lib/google-drive";
import { raiseSystemAlert } from "@/lib/system-alerts";

/**
 * Biblioteca de criativos do Gestor de tráfego. Os arquivos vivem numa pasta do Google Drive
 * com quatro subpastas que espelham a situação; o Zenite Flow guarda os textos do anúncio,
 * a situação e os identificadores na Meta. Arquivo novo em "1 - Para subir" vira Rascunho.
 */
export const SUBFOLDERS = {
  inbox: "1 - Para subir",
  live: "2 - No ar",
  paused: "3 - Pausados",
  failed: "4 - Reprovados ou com falha",
} as const;

export const AD_CREATIVE_STATUS_LABEL: Record<AdCreativeStatus, string> = {
  DRAFT: "Rascunho",
  UPLOADING: "Enviando",
  IN_REVIEW: "Em análise",
  ACTIVE: "No ar",
  PAUSED: "Pausado",
  REJECTED: "Reprovado pela Meta",
  FAILED: "Falha no envio",
};

export const IMAGE_TYPES = ["image/jpeg", "image/png"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const IMAGE_MAX = 30 * 1024 * 1024;
const VIDEO_MAX = 4 * 1024 * 1024 * 1024;

/** Em qual subpasta o arquivo deve ficar para cada situação. */
function folderForStatus(folder: AdCreativeFolder, status: AdCreativeStatus): string {
  if (status === "ACTIVE" || status === "IN_REVIEW") return folder.liveFolderId;
  if (status === "PAUSED") return folder.pausedFolderId;
  if (status === "REJECTED" || status === "FAILED") return folder.failedFolderId;
  return folder.inboxFolderId;
}

/** Avisos de formato que a Meta recusaria ou cortaria (mostrados no cartão do criativo). */
export function creativeWarnings(c: { kind: "IMAGE" | "VIDEO"; mimeType: string; sizeBytes: bigint | number | null; width: number | null; height: number | null }): string[] {
  const out: string[] = [];
  const size = c.sizeBytes === null ? null : Number(c.sizeBytes);
  if (c.kind === "IMAGE" && !IMAGE_TYPES.includes(c.mimeType)) out.push("Formato de imagem não aceito pela Meta (use JPG ou PNG).");
  if (c.kind === "VIDEO" && !VIDEO_TYPES.includes(c.mimeType)) out.push("Formato de vídeo não aceito pela Meta (use MP4 ou MOV).");
  if (size !== null && c.kind === "IMAGE" && size > IMAGE_MAX) out.push("Imagem acima de 30 MB.");
  if (size !== null && c.kind === "VIDEO" && size > VIDEO_MAX) out.push("Vídeo acima de 4 GB.");
  if (c.width && c.height) {
    const ratio = c.width / c.height;
    const near = (target: number) => Math.abs(ratio - target) < 0.03;
    if (!near(1) && !near(4 / 5) && !near(9 / 16) && !near(1.91)) out.push(`Proporção ${c.width}×${c.height} fora dos padrões (1:1, 4:5, 9:16 ou 1,91:1): a Meta pode cortar.`);
    if (c.kind === "IMAGE" && Math.min(c.width, c.height) < 600) out.push("Imagem pequena (menos de 600 px no menor lado).");
  }
  return out;
}

/** Liga uma pasta do Drive à agência: confere o acesso e acha (ou cria) as quatro subpastas. */
export async function connectCreativeFolder(agencyId: string, rootFolderId: string) {
  const root = await getDriveFile(rootFolderId);
  if (!isDriveFolder(root)) throw new Error("O link informado não é de uma pasta.");
  if (!root.capabilities?.canAddChildren) throw new Error("O sistema só tem permissão de leitura nessa pasta. Compartilhe como Editor para ele poder mover os arquivos entre as subpastas.");
  const children = (await listDriveChildren(rootFolderId)).filter(isDriveFolder);
  const ids = {} as Record<keyof typeof SUBFOLDERS, string>;
  for (const key of Object.keys(SUBFOLDERS) as (keyof typeof SUBFOLDERS)[]) {
    const existing = children.find((c) => c.name.trim().toLowerCase() === SUBFOLDERS[key].toLowerCase());
    ids[key] = existing?.id ?? (await createDriveFolder(SUBFOLDERS[key], rootFolderId)).id;
  }
  return prisma.adCreativeFolder.upsert({
    where: { agencyId_rootFolderId: { agencyId, rootFolderId } },
    create: { agencyId, name: root.name, rootFolderId, inboxFolderId: ids.inbox, liveFolderId: ids.live, pausedFolderId: ids.paused, failedFolderId: ids.failed },
    update: { name: root.name, inboxFolderId: ids.inbox, liveFolderId: ids.live, pausedFolderId: ids.paused, failedFolderId: ids.failed },
  });
}

function kindOf(file: DriveFile): "IMAGE" | "VIDEO" | null {
  if (file.mimeType.startsWith("image/")) return "IMAGE";
  if (file.mimeType.startsWith("video/")) return "VIDEO";
  return null;
}

/** Lê as quatro subpastas e atualiza a biblioteca. Arquivo novo vira Rascunho; arquivo que sumiu é marcado. */
export async function syncCreativeFolder(folder: AdCreativeFolder): Promise<{ added: number; updated: number; missing: number }> {
  try {
    const lists = await Promise.all([folder.inboxFolderId, folder.liveFolderId, folder.pausedFolderId, folder.failedFolderId].map(listDriveChildren));
    const files = lists.flat().filter((f) => kindOf(f));
    const existing = await prisma.adCreative.findMany({ where: { folderId: folder.id } });
    const byFile = new Map(existing.map((c) => [c.driveFileId, c]));
    let added = 0;
    let updated = 0;
    for (const file of files) {
      const meta = file.imageMediaMetadata ?? file.videoMediaMetadata;
      const data = {
        fileName: file.name,
        mimeType: file.mimeType,
        kind: kindOf(file)!,
        sizeBytes: file.size ? BigInt(file.size) : null,
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        missingInDrive: false,
      };
      const current = byFile.get(file.id);
      if (!current) {
        await prisma.adCreative.create({ data: { agencyId: folder.agencyId, folderId: folder.id, driveFileId: file.id, name: file.name.replace(/\.[^.]+$/, ""), ...data } });
        added++;
      } else if (current.fileName !== data.fileName || current.missingInDrive || current.width !== data.width || current.height !== data.height || current.sizeBytes !== data.sizeBytes) {
        await prisma.adCreative.update({ where: { id: current.id }, data });
        updated++;
      }
    }
    const seen = new Set(files.map((f) => f.id));
    const gone = existing.filter((c) => !seen.has(c.driveFileId) && !c.missingInDrive);
    if (gone.length) await prisma.adCreative.updateMany({ where: { id: { in: gone.map((c) => c.id) } }, data: { missingInDrive: true } });
    await prisma.adCreativeFolder.update({ where: { id: folder.id }, data: { lastSyncAt: new Date(), lastSyncError: null } });
    return { added, updated, missing: gone.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao ler o Drive.";
    await prisma.adCreativeFolder.update({ where: { id: folder.id }, data: { lastSyncError: message } }).catch(() => null);
    throw error;
  }
}

/**
 * Muda a situação do criativo e move o arquivo para a subpasta correspondente no Drive.
 * Reprovado/Falha também abre alerta na Central de alertas. Falha ao mover não desfaz a situação.
 */
export async function setCreativeStatus(creativeId: string, status: AdCreativeStatus, error?: string | null) {
  const creative = await prisma.adCreative.findUniqueOrThrow({ where: { id: creativeId }, include: { folder: true } });
  await prisma.adCreative.update({ where: { id: creativeId }, data: { status, lastError: status === "REJECTED" || status === "FAILED" ? error ?? creative.lastError : null } });
  const target = folderForStatus(creative.folder, status);
  const source = folderForStatus(creative.folder, creative.status);
  if (target !== source && !creative.missingInDrive) {
    await moveDriveFile(creative.driveFileId, source, target).catch((moveError) => console.error("ad_creative_move_failed", creativeId, moveError));
  }
  if (status === "REJECTED" || status === "FAILED") {
    await raiseSystemAlert({
      agencyId: creative.agencyId,
      key: `ads:creative:${creativeId}`,
      category: "INTEGRATION",
      severity: "WARNING",
      title: status === "REJECTED" ? `Criativo reprovado pela Meta: ${creative.name}` : `Criativo não subiu: ${creative.name}`,
      detail: error ?? "Sem detalhe do erro.",
      href: "/trafego-raio-x/gestor",
    });
  }
}
