import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CONTENT_CHANNEL_LABELS, CONTENT_STATUS_BADGE_CLASS, CONTENT_STATUS_LABELS } from "@/lib/content";
import { prisma } from "@zenith/db";

interface PageProps {
  searchParams: { month?: string };
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseMonth(raw: string | undefined): { year: number; month: number } {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const parts = raw.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default async function CalendarioPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const { year, month } = parseMonth(searchParams.month);
  const rangeStart = new Date(Date.UTC(year, month, 1));
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1));

  const items = await prisma.contentItem.findMany({
    where: {
      agencyId: membership.agencyId,
      scheduledDate: { gte: rangeStart, lt: rangeEnd },
    },
    include: { client: { select: { name: true } } },
    orderBy: { scheduledDate: "asc" },
  });

  const itemsByDay = new Map<number, typeof items>();
  for (const item of items) {
    const day = item.scheduledDate!.getUTCDate();
    const list = itemsByDay.get(day) ?? [];
    list.push(item);
    itemsByDay.set(day, list);
  }

  const firstWeekday = rangeStart.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const nextMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Calendário editorial</h1>
          <p className="text-sm text-[#667085]">
            {items.length} peça{items.length === 1 ? "" : "s"} agendada{items.length === 1 ? "" : "s"} em{" "}
            {MONTH_LABELS[month]} de {year}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/conteudo/planejamento"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Ver lista
          </Link>
          <Link
            href={`/conteudo/calendario?month=${monthParam(prevMonth.year, prevMonth.month)}`}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            ← Anterior
          </Link>
          <span className="text-sm font-semibold text-[#101828]">
            {MONTH_LABELS[month]} {year}
          </span>
          <Link
            href={`/conteudo/calendario?month=${monthParam(nextMonth.year, nextMonth.month)}`}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Próximo →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
        <div className="grid min-w-[900px] grid-cols-7 border-b border-[#EEF0F3] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-3 py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid min-w-[900px] grid-cols-7">
          {cells.map((day, idx) => {
            const dayItems = day ? itemsByDay.get(day) ?? [] : [];
            const cellKey = day
              ? new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
              : null;
            const isToday = cellKey === todayKey;
            return (
              <div
                key={idx}
                className={`min-h-[110px] border-b border-r border-[#EEF0F3] p-2 align-top ${
                  day ? "bg-white" : "bg-[#FAFAFB]"
                }`}
              >
                {day && (
                  <>
                    <p
                      className={`mb-1 text-xs font-semibold ${
                        isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#6847F5] text-white" : "text-[#98A2B3]"
                      }`}
                    >
                      {day}
                    </p>
                    <div className="flex flex-col gap-1">
                      {dayItems.map((item) => (
                        <Link
                          key={item.id}
                          href={`/conteudo/${item.id}`}
                          className={`block truncate rounded px-1.5 py-1 text-xs font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
                          title={`${item.title} · ${item.client.name} · ${CONTENT_CHANNEL_LABELS[item.channel]} · ${CONTENT_STATUS_LABELS[item.status]}`}
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
