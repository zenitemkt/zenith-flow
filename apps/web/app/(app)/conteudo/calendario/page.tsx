import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CONTENT_CHANNEL_LABELS, CONTENT_STATUS_BADGE_CLASS, CONTENT_STATUS_LABELS } from "@/lib/content";
import { MONTH_LABELS, adjacentMonths, monthParam, parseMonth } from "@/lib/content-calendar";
import { CalendarGrid } from "@/app/_components/CalendarGrid";
import { prisma } from "@zenith/db";
import { ContentClientFilter } from "../ContentClientFilter";

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

  const [items, clients] = await Promise.all([
    prisma.contentItem.findMany({
      where: {
        agencyId: membership.agencyId,
        scheduledDate: { gte: rangeStart, lt: rangeEnd },
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeClient = clients.find((c) => c.id === activeClientId);
  const { prevMonth, nextMonth } = adjacentMonths(year, month);

  function calendarHref(targetMonth: string, clientId: string | undefined) {
    const params = new URLSearchParams({ month: targetMonth });
    if (clientId) params.set("clientId", clientId);
    return `/conteudo/calendario?${params.toString()}`;
  }

  const listHref = activeClientId
    ? `/conteudo/planejamento?clientId=${activeClientId}`
    : "/conteudo/planejamento";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Calendário editorial</h1>
          <p className="text-sm text-[#667085]">
            {items.length} peça{items.length === 1 ? "" : "s"} agendada{items.length === 1 ? "" : "s"}{" "}
            {activeClient ? `de ${activeClient.name}` : ""} em {MONTH_LABELS[month]} de {year}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={listHref}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Ver lista
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

      <ContentClientFilter
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) => calendarHref(monthParam(year, month), clientId)}
      />

      <CalendarGrid
        year={year}
        month={month}
        items={items}
        renderItem={(item) => (
          <Link
            key={item.id}
            href={`/conteudo/${item.id}`}
            className={`block truncate rounded px-1.5 py-1 text-xs font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
            title={`${item.title} · ${item.client.name} · ${CONTENT_CHANNEL_LABELS[item.channel]} · ${CONTENT_STATUS_LABELS[item.status]}`}
          >
            {item.title}
          </Link>
        )}
      />
    </div>
  );
}
