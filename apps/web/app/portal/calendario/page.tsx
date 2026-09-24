import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentChannel, ContentStatus } from "@zenite-mkt/db";
import { requirePortalContext } from "@/lib/portal";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { MONTH_LABELS, WEEKDAY_LABELS, adjacentMonths, buildMonthCells, monthParam, parseMonth } from "@/lib/content-calendar";
import { prisma } from "@zenite-mkt/db";
import {
  CONTENT_PHASE_DOT,
  CONTENT_PHASE_LABELS,
  EmptyState,
  PageHeader,
  contentPhase,
  panelClass,
  type ContentPhase,
} from "../_components/ui";

interface PageProps {
  searchParams: { month?: string };
}

interface CalendarEntry {
  id: string;
  title: string;
  channel: ContentChannel;
  status: ContentStatus;
}

const LEGEND: ContentPhase[] = ["waiting", "adjusting", "producing", "approved"];

function EntryChip({ entry }: { entry: CalendarEntry }) {
  const phase = contentPhase(entry.status);
  return (
    <span
      className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-[#E7E4E0]"
      title={`${entry.title} (${CONTENT_CHANNEL_LABELS[entry.channel]}, ${CONTENT_PHASE_LABELS[phase]})`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${CONTENT_PHASE_DOT[phase]}`} />
      <span className="truncate">{entry.title}</span>
    </span>
  );
}

export default async function PortalCalendarioPage({ searchParams }: PageProps) {
  const { client } = await requirePortalContext();

  const { year, month } = parseMonth(searchParams.month);
  const { cells, rangeStart, rangeEnd } = buildMonthCells(year, month);

  const items = await prisma.contentItem.findMany({
    where: { clientId: client.id, scheduledDate: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { scheduledDate: "asc" },
  });

  const itemsByDay = new Map<number, CalendarEntry[]>();
  for (const item of items) {
    if (!item.scheduledDate) continue;
    const day = item.scheduledDate.getUTCDate();
    itemsByDay.set(day, [...(itemsByDay.get(day) ?? []), item]);
  }

  const { prevMonth, nextMonth } = adjacentMonths(year, month);
  const hrefFor = (target: { year: number; month: number }) =>
    `/portal/calendario?month=${monthParam(target.year, target.month)}`;

  const todayKey = new Date().toISOString().slice(0, 10);
  const keyFor = (day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
  const monthName = MONTH_LABELS[month]!.toLowerCase();
  const daysWithItems = Array.from(itemsByDay.keys()).sort((a, b) => a - b);

  const arrowClass =
    "flex h-8 w-8 items-center justify-center rounded-full text-[#A3A5B2] transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A]";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Calendário"
        description={
          items.length === 0
            ? `Nenhuma publicação marcada em ${monthName} de ${year}.`
            : `${items.length} ${items.length === 1 ? "publicação" : "publicações"} em ${monthName} de ${year}.`
        }
        actions={
          <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
            <Link href={hrefFor(prevMonth)} aria-label="Mês anterior" className={arrowClass}>
              <ChevronLeft size={17} aria-hidden />
            </Link>
            <span className="min-w-[128px] text-center font-display text-sm font-semibold">
              {MONTH_LABELS[month]} {year}
            </span>
            <Link href={hrefFor(nextMonth)} aria-label="Próximo mês" className={arrowClass}>
              <ChevronRight size={17} aria-hidden />
            </Link>
          </div>
        }
      />

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#A3A5B2]">
        {LEGEND.map((phase) => (
          <li key={phase} className="flex items-center gap-1.5">
            <span aria-hidden className={`h-2 w-2 rounded-full ${CONTENT_PHASE_DOT[phase]}`} />
            {CONTENT_PHASE_LABELS[phase]}
          </li>
        ))}
      </ul>

      <div className={`${panelClass} hidden overflow-hidden md:block`}>
        <div className="grid grid-cols-7 border-b border-white/[0.06]">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-3 py-3 text-xs font-medium text-[#8B8D9A]">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            const entries = day ? itemsByDay.get(day) ?? [] : [];
            const isToday = day !== null && keyFor(day) === todayKey;
            const lastColumn = index % 7 === 6;
            return (
              <div
                key={index}
                className={`min-h-[118px] border-b border-white/[0.05] p-2 ${lastColumn ? "" : "border-r"} ${
                  day ? "" : "bg-black/25"
                } ${isToday ? "bg-[#FF2B00]/[0.06]" : ""}`}
              >
                {day && (
                  <>
                    <span
                      className={`mb-1.5 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-xs font-medium ${
                        isToday
                          ? "bg-[#FF2B00] text-white shadow-[0_0_16px_rgba(255,43,0,0.7)]"
                          : entries.length > 0
                            ? "text-[#F5F2EE]"
                            : "text-[#5E6070]"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="flex flex-col gap-1">
                      {entries.map((entry) => (
                        <EntryChip key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden">
        {daysWithItems.length === 0 ? (
          <EmptyState title="Mês livre por enquanto">
            Quando a equipe agendar publicações neste mês, elas aparecem aqui dia a dia.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {daysWithItems.map((day) => {
              const date = new Date(Date.UTC(year, month, day));
              const isToday = keyFor(day) === todayKey;
              return (
                <li key={day} className={`${panelClass} flex gap-4 p-4`}>
                  <span
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border ${
                      isToday ? "border-[#FF2B00]/60 bg-[#1D1210]" : "border-white/[0.07] bg-[#0E0F15]"
                    }`}
                  >
                    <span className="font-display text-lg font-semibold leading-none">{day}</span>
                    <span className="mt-0.5 text-[10px] text-[#8B8D9A]">
                      {date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")}
                    </span>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {(itemsByDay.get(day) ?? []).map((entry) => (
                      <EntryChip key={entry.id} entry={entry} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
