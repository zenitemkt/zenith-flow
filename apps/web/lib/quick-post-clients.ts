import { prisma } from "@zenite-mkt/db";
import type { QuickPostClient } from "@/app/(app)/operacao/_components/QuickPostForm";
import { visibleClientWhere } from "@/lib/client-access";

/**
 * Clientes com Instagram/Facebook conectado — os únicos que aparecem na
 * publicação direta (Calendário e Operação > Publicação). O cliente do filtro
 * sempre entra (mesmo sem redes), para o formulário abrir já nele e avisar.
 */
export async function loadQuickPostClients(agencyId: string, activeClientId?: string, hidden: string[] = []): Promise<QuickPostClient[]> {
  const connected = await prisma.client.findMany({
    where: { AND: [visibleClientWhere(hidden)],
      agencyId,
      socialConnections: { some: { platform: { in: ["INSTAGRAM", "FACEBOOK"] }, status: { not: "REVOKED" } } },
    },
    select: {
      id: true,
      name: true,
      defaultPublishTime: true,
      avatarKey: true,
      socialConnections: {
        where: { platform: { in: ["INSTAGRAM", "FACEBOOK"] }, status: { not: "REVOKED" } },
        select: { platform: true, name: true, username: true, pictureUrl: true, status: true },
        orderBy: { platform: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const clients: QuickPostClient[] = connected.map((c) => ({
    id: c.id,
    name: c.name,
    defaultPublishTime: c.defaultPublishTime,
    hasAvatar: Boolean(c.avatarKey),
    connections: c.socialConnections.map((conn) => ({
      platform: conn.platform,
      name: conn.name,
      username: conn.username,
      pictureUrl: conn.pictureUrl,
      active: conn.status === "ACTIVE",
    })),
  }));

  if (activeClientId && !clients.some((c) => c.id === activeClientId)) {
    const filtered = await prisma.client.findFirst({ where: { AND: [visibleClientWhere(hidden)], id: activeClientId, agencyId }, select: { id: true, name: true } });
    if (filtered) clients.unshift({ id: filtered.id, name: filtered.name, defaultPublishTime: "10:00", hasAvatar: false, connections: [] });
  }
  return clients;
}
