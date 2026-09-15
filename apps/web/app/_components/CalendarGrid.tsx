import type { ReactNode } from "react";
import { WEEKDAY_LABELS, buildMonthCells } from "@/lib/content-calendar";

interface CalendarItem {
  id: string;
  scheduledDate: Date | null;
}

export function CalendarGrid<T extends CalendarItem>({
  year,
  month,
  items,
  renderItem,
}: {
  year: number;
  month: number;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  const { cells } = buildMonthCells(year, month);

  const itemsByDay = new Map<number, T[]>();
  for (const item of items) {
    if (!item.scheduledDate) continue;
    const day = item.scheduledDate.getUTCDate();
    const list = itemsByDay.get(day) ?? [];
    list.push(item);
    itemsByDay.set(day, list);
  }

  const todayKey = new Date().toISOString().slice(0, 10);

  return (
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
                      isToday
                        ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FF2B00] text-white"
                        : "text-[#98A2B3]"
                    }`}
                  >
                    {day}
                  </p>
                  <div className="flex flex-col gap-1">{dayItems.map((item) => renderItem(item))}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
