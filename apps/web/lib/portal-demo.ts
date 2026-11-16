import { prisma } from "@zenite-mkt/db";

/** Logins de demonstração: veem um painel fictício (só no navegador), nunca dados do próprio CRM. */
export const DEMO_EMAILS = (process.env.DEMO_PORTAL_EMAILS || "demo@zenitehub.com.br").split(",").map((e) => e.trim().toLowerCase());
export const isDemoEmail = (email: string | null | undefined) => !!email && DEMO_EMAILS.includes(email.toLowerCase());

/** Arte real usada no demo: imagem servida por /api/portal/demo-media/:id e a legenda da publicação. */
export interface DemoRealArt {
  src: string;
  caption: string;
}
export interface DemoRealArtSet {
  feed: DemoRealArt[];
  story: DemoRealArt[];
}

/**
 * Cliente cujas artes ilustram o demo: o da própria Zenite. `DEMO_PORTAL_SOURCE_CLIENT_ID` fixa o id;
 * sem ele, o primeiro cliente da agência com "Zenite"/"Zênite" no nome (nunca o próprio cliente demo).
 */
export async function demoSourceClientId(agencyId: string, demoClientId: string): Promise<string | null> {
  const fixed = process.env.DEMO_PORTAL_SOURCE_CLIENT_ID?.trim();
  if (fixed) {
    const c = await prisma.client.findFirst({ where: { id: fixed, agencyId }, select: { id: true } });
    return c?.id ?? null;
  }
  const c = await prisma.client.findFirst({
    where: { agencyId, id: { not: demoClientId }, OR: [{ name: { contains: "zenite", mode: "insensitive" } }, { name: { contains: "zênite", mode: "insensitive" } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return c?.id ?? null;
}

/** Imagens das publicações agendadas e publicadas da Zenite (feed e story), sem repetir a mesma arte. */
export async function loadDemoRealArt(agencyId: string, demoClientId: string): Promise<DemoRealArtSet> {
  const empty = { feed: [], story: [] };
  try {
    const sourceId = await demoSourceClientId(agencyId, demoClientId);
    if (!sourceId) return empty;
    const posts = await prisma.socialPost.findMany({
      where: { agencyId, clientId: sourceId, status: { in: ["PUBLISHED", "SCHEDULED"] }, format: { in: ["FEED", "STORY"] }, versionId: { not: null } },
      orderBy: { publishAt: "desc" },
      take: 200,
      select: { format: true, caption: true, versionId: true, version: { select: { media: { orderBy: { position: "asc" }, select: { id: true, contentType: true } } } } },
    });
    const seen = new Set<string>();
    const out: DemoRealArtSet = { feed: [], story: [] };
    for (const p of posts) {
      const media = p.version?.media.find((m) => m.contentType.startsWith("image/"));
      if (!media || seen.has(media.id)) continue;
      seen.add(media.id);
      const list = p.format === "STORY" ? out.story : out.feed;
      if (list.length < 30) list.push({ src: `/api/portal/demo-media/${media.id}`, caption: p.caption?.trim() ?? "" });
    }
    return out;
  } catch (error) {
    console.error("[portal-demo] falha ao carregar artes reais", error);
    return empty;
  }
}

/** A mídia pertence a uma publicação (agendada/publicada) do cliente de origem do demo? */
export async function isDemoSourceMedia(mediaId: string, agencyId: string, demoClientId: string) {
  const sourceId = await demoSourceClientId(agencyId, demoClientId);
  if (!sourceId) return null;
  const media = await prisma.contentVersionMedia.findFirst({
    where: {
      id: mediaId,
      contentType: { startsWith: "image/" },
      version: { socialPosts: { some: { agencyId, clientId: sourceId, status: { in: ["PUBLISHED", "SCHEDULED"] } } } },
    },
    select: { key: true, driveFileId: true, contentType: true },
  });
  return media;
}
