import Link from "next/link";
import { requirePortalContext } from "@/lib/portal";
import { CONTENT_CHANNEL_LABELS, CONTENT_STATUS_BADGE_CLASS, CONTENT_STATUS_LABELS } from "@/lib/content";
import { MONTH_LABELS, adjacentMonths, monthParam, parseMonth } from "@/lib/content-calendar";
import { CalendarGrid } from "@/app/_components/CalendarGrid";
import { prisma } from "@zenite-mkt/db";

interface PageProps {
  searchParams: { month?: string };
}

export default async function PortalCalendarioPage({ searchParams }: PageProps) {
  const { client } = await requirePortalContext();

  const { year, month } = parseMonth(searchParams.month);
  const rangeStart = new Date(Date.UTC(year, month, 1));
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1));

  const items = await prisma.contentItem.findMany({
    where: { clientId: client.id, scheduledDate: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { scheduledDate: "asc" },
  });

  const { prevMonth, nextMonth } = adjacentMonths(year, month);
  const hrefFor = (targetMonth: string) => `/portal/calendario?month=${targetMonth}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Calendário</h1>
          <p className="text-sm text-[#9CA0AD]">
            {items.length} peça{items.length === 1 ? "" : "s"} agendada{items.length === 1 ? "" : "s"} em{" "}
            {MONTH_LABELS[month]} de {year}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={hrefFor(monthParam(prevMonth.year, prevMonth.month))}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            ← Anterior
          </Link>
          <span className="text-sm font-semibold text-white">
            {MONTH_LABELS[month]} {year}
          </span>
          <Link
            href={hrefFor(monthParam(nextMonth.year, nextMonth.month))}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Próximo →
          </Link>
        </div>
      </div>

      <CalendarGrid
        year={year}
        month={month}
        items={items}
        renderItem={(item) => (
          <span
            key={item.id}
            className={`block truncate rounded px-1.5 py-1 text-xs font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
            title={`${item.title} · ${CONTENT_CHANNEL_LABELS[item.channel]} · ${CONTENT_STATUS_LABELS[item.status]}`}
          >
            {item.title}
          </span>
        )}
      />
    </div>
  );
}
