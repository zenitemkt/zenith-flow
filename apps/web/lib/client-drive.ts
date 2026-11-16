import { prisma } from "@zenite-mkt/db";
import { createDriveFolder, getDriveFile, moveDriveFile, shareDriveFileWithEmail } from "@/lib/google-drive";
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
  if (existing) {
    // Pastas criadas antes da pasta de materiais brutos ganham ela agora.
    if (existing.rawId) return existing;
    const raw = await createDriveFolder("0 - Materiais brutos (fotos e vídeos)", existing.rootId);
    return prisma.clientDriveFolder.update({ where: { id: existing.id }, data: { rawId: raw.id } });
  }
  const client = await prisma.client.findFirst({ where: { id: clientId, agencyId }, select: { name: true, driveUrl: true } });
  if (!client) throw new Error("Cliente não encontrado.");
  const root = await createDriveFolder(driveName(client.name), await clientsRoot(agencyId));
  const [raw, awaiting, rework, approved, published] = await Promise.all([
    createDriveFolder("0 - Materiais brutos (fotos e vídeos)", root.id),
    createDriveFolder("1 - Aguardando aprovação", root.id),
    createDriveFolder("2 - Retrabalho", root.id),
    createDriveFolder("3 - Aprovado", root.id),
    createDriveFolder("4 - Publicados", root.id),
  ]);
  const saved = await prisma.clientDriveFolder.create({
    data: { agencyId, clientId, rootId: root.id, rawId: raw.id, awaitingId: awaiting.id, reworkId: rework.id, approvedId: approved.id, publishedId: published.id },
  });
  if (!client.driveUrl) await prisma.client.update({ where: { id: clientId }, data: { driveUrl: `https://drive.google.com/drive/folders/${root.id}` } });
  return saved;
}

/**
 * Garante a pasta e dá acesso de editor ao cliente: e-mail do cadastro e logins do portal.
 * Cada e-mail recebe o convite uma vez só (lista guardada em `sharedEmails`).
 */
export async function syncClientDriveAccess(agencyId: string, clientId: string): Promise<string[]> {
  const folder = await ensureClientDriveFolders(agencyId, clientId);
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { email: true, workspaceId: true } });
  const portal = client?.workspaceId
    ? await prisma.membership.findMany({ where: { workspaceId: client.workspaceId, role: { in: ["CLIENT_ADMIN", "CLIENT_VIEWER"] } }, select: { email: true } })
    : [];
  const emails = Array.from(new Set([client?.email, ...portal.map((m) => m.email)].map((e) => e?.trim().toLowerCase()).filter((e): e is string => Boolean(e && e.includes("@")))));
  const pending = emails.filter((e) => !folder.sharedEmails.includes(e));
  const shared: string[] = [];
  for (const email of pending) {
    try {
      await shareDriveFileWithEmail(folder.rootId, email);
      shared.push(email);
    } catch (error) {
      console.error("client_drive_share_failed", email, error);
    }
  }
  if (shared.length) await prisma.clientDriveFolder.update({ where: { id: folder.id }, data: { sharedEmails: { push: shared } } });
  return shared;
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
