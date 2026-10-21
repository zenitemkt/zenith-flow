import Link from "next/link";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { requireSessionAndMembership } from "@/lib/session";
import { MONTH_LABELS, adjacentMonths, monthParam, parseMonth } from "@/lib/content-calendar";
import { prisma } from "@zenite-mkt/db";
import { ClientFilterPills } from "@/app/_components/ClientFilterPills";
import type { CalendarContentItem, CalendarSocialPost } from "./InteractiveContentCalendar";
import type { QuickPostClient } from "./QuickPostModal";

/** Code-split: framer-motion só baixa quando esta rota é visitada. */
const InteractiveContentCalendar = dynamic(() =>
  import("./InteractiveContentCalendar").then((m) => m.InteractiveContentCalendar),
);

const NON_PENDING_STATUSES = ["AGENDADO", "PUBLICADO", "ARQUIVADO"] as const;

interface PageProps {
  searchParams: { month?: string; clientId?: string };
}

export default async function CalendarioPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const { year, month } = parseMonth(searchParams.month);
  const rangeStart = new Date(Date.UTC(year, month, 1));
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1));
  const activeClientId = searchParams.clientId;

  const [monthItems, pendingItems, clients, socialPosts, connectedClients] = await Promise.all([
    prisma.contentItem.findMany({
      where: {
        agencyId: membership.agencyId,
        scheduledDate: { gte: rangeStart, lt: rangeEnd },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.contentItem.findMany({
      where: {
        agencyId: membership.agencyId,
        status: { notIn: [...NON_PENDING_STATUSES] },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Publicações nas redes do mês (em São Paulo: o mês começa às 03:00 UTC do dia 1).
    prisma.socialPost.findMany({
      where: {
        agencyId: membership.agencyId,
        status: { not: "CANCELED" },
        publishAt: { gte: new Date(rangeStart.getTime() + 3 * 3600_000), lt: new Date(rangeEnd.getTime() + 3 * 3600_000) },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      select: {
        id: true,
        platform: true,
        status: true,
        publishAt: true,
        contentItemId: true,
        contentItem: { select: { title: true } },
        client: { select: { name: true } },
      },
      orderBy: { publishAt: "asc" },
    }),
    // Clientes com Instagram/Facebook conectado — os únicos que aparecem na publicação direta.
    prisma.client.findMany({
      where: {
        agencyId: membership.agencyId,
        socialConnections: { some: { platform: { in: ["INSTAGRAM", "FACEBOOK"] }, status: { not: "REVOKED" } } },
      },
      select: {
        id: true,
        name: true,
        defaultPublishTime: true,
        socialConnections: {
          where: { platform: { in: ["INSTAGRAM", "FACEBOOK"] }, status: { not: "REVOKED" } },
          select: { platform: true, name: true, status: true },
          orderBy: { platform: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const quickPostClients: QuickPostClient[] = connectedClients.map((c) => ({
    id: c.id,
    name: c.name,
    defaultPublishTime: c.defaultPublishTime,
    connections: c.socialConnections.map((conn) => ({ platform: conn.platform, name: conn.name, active: conn.status === "ACTIVE" })),
  }));

  const calendarPosts: CalendarSocialPost[] = socialPosts.map((p) => ({
    id: p.id,
    contentItemId: p.contentItemId,
    title: p.contentItem?.title ?? "Publicação",
    clientName: p.client.name,
    platform: p.platform,
    status: p.status,
    publishAtISO: p.publishAt.toISOString(),
  }));

  const toCalendarItem = (item: (typeof monthItems)[number]): CalendarContentItem => ({
    id: item.id,
    title: item.title,
    status: item.status,
    channel: item.channel,
    scheduledDateISO: item.scheduledDate ? item.scheduledDate.toISOString() : null,
    client: { name: item.client.name },
  });

  const activeClient = clients.find((c) => c.id === activeClientId);
  const { prevMonth, nextMonth } = adjacentMonths(year, month);

  function calendarHref(targetMonth: string, clientId: string | undefined) {
    const params = new URLSearchParams({ month: targetMonth });
    if (clientId) params.set("clientId", clientId);
    return `/operacao/calendario?${params.toString()}`;
  }

  const listHref = activeClientId ? `/operacao?clientId=${activeClientId}` : "/operacao";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Calendário editorial</h1>
          <p className="text-sm text-[#667085]">
            {monthItems.length} peça{monthItems.length === 1 ? "" : "s"} agendada{monthItems.length === 1 ? "" : "s"}{" "}
            {activeClient ? `de ${activeClient.name}` : ""} em {MONTH_LABELS[month]} de {year}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={listHref}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Ver Kanban
          </Link>
          <Link
            href={calendarHref(monthParam(prevMonth.year, prevMonth.month), activeClientId)}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            ← Anterior
          </Link>
          <span className="text-sm font-semibold text-[#101828]">
            {MONTH_LABELS[month]} {year}
          </span>
          <Link
            href={calendarHref(monthParam(nextMonth.year, nextMonth.month), activeClientId)}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Próximo →
          </Link>
        </div>
      </div>

      <ClientFilterPills
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) => calendarHref(monthParam(year, month), clientId)}
      />

      <InteractiveContentCalendar
        year={year}
        month={month}
        monthItems={monthItems.map(toCalendarItem)}
        pendingItems={pendingItems.map(toCalendarItem)}
        posts={calendarPosts}
        quickPostClients={quickPostClients}
        activeClientId={activeClientId}
      />
    </div>
  );
}
