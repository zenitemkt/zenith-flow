import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { clientInitials, defaultBannerGradient, isClientActive, parseSocialLinks, SOCIAL_NETWORKS } from "@/lib/clients";
import { contentBoardColumnForStatus } from "@/lib/content";
import { prisma } from "@zenite-mkt/db";
import { canManageTeam } from "@/lib/rbac";
import { ClientsBoard, type ClientCardData } from "./ClientsBoard";

export default async function CarteiraPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [clients, contentCounts] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: {
        id: true,
        name: true,
        status: true,
        avatarKey: true,
        bannerKey: true,
        socialLinks: true,
        segment: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.contentItem.groupBy({
      by: ["clientId", "status"],
      where: { agencyId: membership.agencyId, status: { not: "ARQUIVADO" } },
      _count: { _all: true },
    }),
  ]);

  // Mesmos grupos do quadro de Operação: "Feitos" junta Agendar + Concluído.
  const countsByClient = new Map<string, ClientCardData["counts"]>();
  for (const row of contentCounts) {
    const counts = countsByClient.get(row.clientId) ?? { todo: 0, doing: 0, review: 0, done: 0 };
    const column = contentBoardColumnForStatus(row.status);
    if (column === "a_fazer") counts.todo += row._count._all;
    else if (column === "fazendo") counts.doing += row._count._all;
    else if (column === "aguardando_aprovacao") counts.review += row._count._all;
    else counts.done += row._count._all;
    countsByClient.set(row.clientId, counts);
  }

  const cards: ClientCardData[] = clients.map((client) => {
    const links = parseSocialLinks(client.socialLinks);
    return {
      id: client.id,
      name: client.name,
      segment: client.segment?.name ?? null,
      active: isClientActive(client.status),
      initials: clientInitials(client.name),
      hasAvatar: Boolean(client.avatarKey),
      hasBanner: Boolean(client.bannerKey),
      bannerGradient: defaultBannerGradient(client.id),
      socials: SOCIAL_NETWORKS.flatMap(({ id }) => (links[id] ? [{ network: id, url: links[id]! }] : [])),
      counts: countsByClient.get(client.id) ?? { todo: 0, doing: 0, review: 0, done: 0 },
    };
  });

  return <ClientsBoard clients={cards} agencyName={membership.agency.name} canDelete={canManageTeam(membership.role)} />;
}
