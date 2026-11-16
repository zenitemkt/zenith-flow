import { prisma } from "@zenite-mkt/db";
import { createDriveFolder, getDriveFile, moveDriveFile } from "@/lib/google-drive";
import { SocialDriveNotReady } from "@/lib/social-drive";

/**
 * Pasta de cada cliente no Drive compartilhado (mesmo Drive dos criativos do Gestor):
 * "Clientes (Zenite Flow)/<Cliente>/" com "1 - Aguardando aprovação", "2 - Retrabalho",
 * "3 - Aprovado" e "4 - Publicados". O arquivo nasce em Aguardando e muda de pasta sozinho
 * conforme a aprovação e a publicação. Chamar dentro de `withAgencyDrive`.
 */
export type ClientDriveStage = "awaiting" | "rework" | "approved" | "published";

const driveName = (name: string) => name.replace(/[\\/]+/g, "-").trim().slice(0, 100) || "Cliente";

async function clientsRoot(agencyId: string): Promise<string> {
  const saved = await prisma.driveClientsRoot.findUnique({ where: { agencyId } });
  if (saved) return saved.rootId;
  const creatives = await prisma.adCreativeFolder.findFirst({ where: { agencyId }, orderBy: { createdAt: "asc" } });
  if (!creatives) throw new SocialDriveNotReady("Conecte a pasta do Drive no Gestor de tráfego (aba Criativos) para criar as pastas dos clientes.");
  const parent = (await getDriveFile(creatives.rootFolderId)).parents?.[0] ?? creatives.rootFolderId;
  const root = await createDriveFolder("Clientes (Zenite Flow)", parent);
  await prisma.driveClientsRoot.create({ data: { agencyId, rootId: root.id } });
  return root.id;
}

export async function ensureClientDriveFolders(agencyId: string, clientId: string) {
  const existing = await prisma.clientDriveFolder.findUnique({ where: { clientId } });
  if (existing) return existing;
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId }, select: { name: true, driveUrl: true } });
  if (!client) throw new Error("Cliente não encontrado.");
  const root = await createDriveFolder(driveName(client.name), await clientsRoot(agencyId));
  const [awaiting, rework, approved, published] = await Promise.all([
    createDriveFolder("1 - Aguardando aprovação", root.id),
    createDriveFolder("2 - Retrabalho", root.id),
    createDriveFolder("3 - Aprovado", root.id),
    createDriveFolder("4 - Publicados", root.id),
  ]);
  const saved = await prisma.clientDriveFolder.create({
    data: { agencyId, clientId, rootId: root.id, awaitingId: awaiting.id, reworkId: rework.id, approvedId: approved.id, publishedId: published.id },
  });
  if (!client.driveUrl) await prisma.client.update({ where: { id: clientId }, data: { driveUrl: `https://drive.google.com/drive/folders/${root.id}` } });
  return saved;
}

/** Move os arquivos (que estiverem em alguma etapa da pasta do cliente) para outra etapa. */
export async function moveClientDriveFiles(clientId: string, fileIds: string[], to: ClientDriveStage) {
  if (!fileIds.length) return;
  const f = await prisma.clientDriveFolder.findUnique({ where: { clientId } });
  if (!f) return;
  const stages = [f.awaitingId, f.reworkId, f.approvedId, f.publishedId];
  const target = { awaiting: f.awaitingId, rework: f.reworkId, approved: f.approvedId, published: f.publishedId }[to];
  for (const id of Array.from(new Set(fileIds))) {
    const file = await getDriveFile(id).catch(() => null);
    const from = file?.parents?.find((p) => p !== target && stages.includes(p));
    if (from) await moveDriveFile(id, from, target).catch((error) => console.error("client_drive_move_failed", id, error));
  }
}
