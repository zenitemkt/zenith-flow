import { prisma } from "@zenite-mkt/db";
import { SOCIAL_NETWORKS, normalizeSocialUrl, type SocialLinks } from "@/lib/clients";

/** Server-only. Lê `socialLinks` do corpo da requisição e devolve só URLs http(s) válidas por rede conhecida. */
export function readSocialLinks(raw: unknown): SocialLinks {
  const links: SocialLinks = {};
  if (!raw || typeof raw !== "object") return links;
  const source = raw as Record<string, unknown>;
  for (const { id } of SOCIAL_NETWORKS) {
    const value = source[id];
    if (typeof value !== "string") continue;
    const url = normalizeSocialUrl(id, value);
    if (url) links[id] = url;
  }
  return links;
}

/**
 * Ramo de atuação: reaproveita o ramo existente (sem diferenciar maiúsculas)
 * ou cria um novo — a lista da agência cresce conforme entram clientes.
 * Texto vazio = cliente sem ramo.
 */
export async function resolveSegmentId(agencyId: string, rawName: unknown): Promise<string | null> {
  if (typeof rawName !== "string") return null;
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) return null;

  const existing = await prisma.clientSegment.findFirst({
    where: { agencyId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.clientSegment.upsert({
    where: { agencyId_name: { agencyId, name } },
    create: { agencyId, name },
    update: {},
    select: { id: true },
  });
  return created.id;
}
