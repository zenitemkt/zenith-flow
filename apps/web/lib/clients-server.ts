import { prisma } from "@zenite-mkt/db";
import { SOCIAL_NETWORKS, normalizeSocialUrl, type SocialLinks } from "@/lib/clients";

/**
 * Link da pasta do Google Drive do cliente. `undefined` = campo não enviado
 * (não mexe), `null` = limpar, string = URL http(s) válida; `false` = inválido.
 */
export function readDriveUrl(raw: unknown): string | null | undefined | false {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : false;
  } catch {
    return false;
  }
}

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
