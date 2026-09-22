import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageAnyTask } from "@/lib/rbac";
import { getAgencyMembers } from "@/lib/team";
import { ClientFilterPills } from "@/app/_components/ClientFilterPills";
import { prisma } from "@zenite-mkt/db";
import { ContentBoard, type BoardContentItem } from "./ContentBoard";
import { NewContentModal } from "./NewContentModal";
import { RefreshButton } from "./RefreshButton";

interface PageProps {
  searchParams: { clientId?: string };
}

export default async function OperacaoPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const activeClientId = searchParams.clientId;

  const [items, clients, people] = await Promise.all([
    prisma.contentItem.findMany({
      where: {
        agencyId: membership.agencyId,
        status: { not: "ARQUIVADO" },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { approval: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAgencyMembers(membership.agencyId),
  ]);

  const boardItems: BoardContentItem[] = items.map((item) => {
    const latestVersion = item.versions[0] ?? null;
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      channel: item.channel,
      format: item.format,
      scheduledDateISO: item.scheduledDate ? item.scheduledDate.toISOString() : null,
      clientId: item.clientId,
      clientName: item.client.name,
      hasVersion: Boolean(latestVersion),
      approvalToken: item.status === "AGUARDANDO_CLIENTE" ? (latestVersion?.approval?.token ?? null) : null,
      assigneeUserIds: item.assigneeUserIds,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Operação</h1>
          <p className="text-sm text-[#667085]">
            {boardItems.length} peça{boardItems.length === 1 ? "" : "s"} em produção em {membership.agency.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <NewContentModal clients={clients} people={people} />
        </div>
      </div>

      <ClientFilterPills
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) => (clientId ? `/operacao?clientId=${clientId}` : "/operacao")}
      />

      <ContentBoard items={boardItems} people={people} canManage={canManageAnyTask(membership.role)} />
    </div>
  );
}
