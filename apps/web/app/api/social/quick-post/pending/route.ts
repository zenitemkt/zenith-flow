import { NextResponse } from "next/server";
import { prisma, type SocialPlatform, type SocialPostFormat } from "@zenite-mkt/db";
import { getServerSession, getCurrentMembership } from "@/lib/session";
import { isClientRole } from "@/lib/rbac";
import { canSeeClient } from "@/lib/client-access";
import { QUICK_POST_AUDIT_ACTION, QUICK_POST_FORMAT_LABEL } from "@/lib/social-quick-post";

const FORMAT_BY_LABEL = Object.fromEntries(Object.entries(QUICK_POST_FORMAT_LABEL).map(([format, label]) => [label, format])) as Record<string, SocialPostFormat>;

/**
 * Publicações criadas pela publicação direta que já têm arte enviada mas nunca chegaram a ser
 * agendadas (a pessoa fechou no meio, ou o passo final falhou) — pra continuar em vez de reenviar
 * o arquivo do zero. Some da lista sozinha assim que a publicação é agendada de verdade.
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const membership = await getCurrentMembership(session.user.id);
  if (!membership || isClientRole(membership.role)) return NextResponse.json({ error: "Acesso restrito à equipe da agência." }, { status: 403 });

  const clientId = new URL(request.url).searchParams.get("clientId") ?? "";
  if (!clientId || !(await canSeeClient(membership.agencyId, session.user.id, clientId))) return NextResponse.json({ items: [] });

  const items = await prisma.contentItem.findMany({
    where: { agencyId: membership.agencyId, clientId, status: "PRODUCAO", socialPosts: { none: {} }, versions: { some: { media: { some: {} } } } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      caption: true,
      pendingCoverKey: true,
      createdAt: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { media: { orderBy: { position: "asc" }, select: { id: true, fileName: true, contentType: true, sizeBytes: true } } } },
    },
  });
  if (items.length === 0) return NextResponse.json({ items: [] });

  const logs = await prisma.auditLog.findMany({
    where: { agencyId: membership.agencyId, action: QUICK_POST_AUDIT_ACTION, resourceType: "content_item", resourceId: { in: items.map((i) => i.id) } },
    select: { resourceId: true, metadata: true },
  });
  const metaByItem = new Map(logs.map((l) => [l.resourceId, l.metadata as { platforms?: string[]; format?: string } | null]));

  const result = items
    .map((item) => {
      const media = item.versions[0]?.media ?? [];
      if (media.length === 0) return null;
      const meta = metaByItem.get(item.id);
      const platforms = (Array.isArray(meta?.platforms) ? meta.platforms : []).filter((p): p is SocialPlatform => ["INSTAGRAM", "FACEBOOK", "GOOGLE_BUSINESS"].includes(p));
      const format = (typeof meta?.format === "string" ? meta.format : null) as SocialPostFormat | null;
      return {
        id: item.id,
        title: item.title,
        caption: item.caption,
        createdAt: item.createdAt,
        platforms,
        format: format && format in QUICK_POST_FORMAT_LABEL ? format : FORMAT_BY_LABEL["Feed"],
        pendingCoverKey: item.pendingCoverKey,
        media,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return NextResponse.json({ items: result });
}
