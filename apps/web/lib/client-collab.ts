import { prisma } from "@zenite-mkt/db";

const MAX_SAVED = 20;

/** Guarda perfis usados em collab do Instagram deste cliente, pra sugerir de novo depois. */
export async function rememberCollabHandles(clientId: string, handles: string[]): Promise<void> {
  if (handles.length === 0) return;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { collabHandles: true } });
  if (!client) return;
  const merged = [...client.collabHandles];
  for (const handle of handles) {
    if (!merged.some((saved) => saved.toLowerCase() === handle.toLowerCase())) merged.push(handle);
  }
  if (merged.length === client.collabHandles.length) return;
  await prisma.client.update({ where: { id: clientId }, data: { collabHandles: merged.slice(-MAX_SAVED) } });
}
