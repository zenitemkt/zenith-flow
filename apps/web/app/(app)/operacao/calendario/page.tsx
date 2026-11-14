import Link from "next/link";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { requireSessionAndMembership } from "@/lib/session";
import { MONTH_LABELS, adjacentMonths, monthParam, parseMonth } from "@/lib/content-calendar";
import { prisma } from "@zenite-mkt/db";
import { ClientFilterSelect } from "@/app/_components/ClientFilterSelect";
import { filterableClients } from "@/lib/clients";
import { loadQuickPostClients } from "@/lib/quick-post-clients";
import type { CalendarContentItem, CalendarSocialPost } from "./InteractiveContentCalendar";
import { getHiddenClientIds, visibleByClientWhere, visibleClientWhere } from "@/lib/client-access";

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
  const hidden = await getHiddenClientIds(membership.agencyId, session.user.id);

  const { year, month } = parseMonth(searchParams.month);
  const rangeStart = new Date(Date.UTC(year, month, 1));
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1));
  const activeClientId = searchParams.clientId;

  const [monthItems, pendingItems, clients, socialPosts, quickPostClients] = await Promise.all([
    prisma.contentItem.findMany({
      where: { AND: [visibleByClientWhere(hidden)],
        agencyId: membership.agencyId,
        scheduledDate: { gte: rangeStart, lt: rangeEnd },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.contentItem.findMany({
      where: { AND: [visibleByClientWhere(hidden)],
        agencyId: membership.agencyId,
        status: { notIn: [...NON_PENDING_STATUSES] },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.client.findMany({
      where: { AND: [visibleClientWhere(hidden)], agencyId: membership.agencyId },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    // Publicações nas redes do mês (em São Paulo: o mês começa às 03:00 UTC do dia 1).
    prisma.socialPost.findMany({
      where: { AND: [visibleByClientWhere(hidden)],
        agencyId: membership.agencyId,
        status: { not: "CANCELED" },
        // Peça excluída some do Calendário junto com as publicações dela.
        contentItemId: { not: null },
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
    loadQuickPostClients(membership.agencyId, activeClientId, hidden),
  ]);

  const calendarPosts: CalendarSocialPost[] = socialPosts.map((p) => ({
    id: p.id,
    contentItemId: p.contentItemId,
    title: p.contentItem?.title ?? "Publicação",
    clientName: p.client.name,
    platform: p.platform,
    status: p.status,
    publishAtISO: p.publishAt.toISOString(),
    // Mais de 5 min além do horário e ainda "agendado": o agendador não passou por ele.
    late: p.status === "SCHEDULED" && p.publishAt.getTime() < Date.now() - 5 * 60_000,
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

      <ClientFilterSelect
        // Só clientes ativos entram na lista; o filtrado continua visível mesmo se inativo.
        clients={filterableClients(clients, activeClientId)}
        activeClientId={activeClientId}
        basePath="/operacao/calendario"
        params={{ month: monthParam(year, month) }}
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
