"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, ListChecks, Check } from "lucide-react";
import { WEEKDAY_LABELS, buildMonthCells } from "@/lib/content-calendar";
import {
  CONTENT_CALENDAR_BUCKET_CLASS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_BADGE_CLASS,
  CONTENT_STATUS_LABELS,
  contentCalendarBucket,
} from "@/lib/content";
import type { ContentChannel, ContentStatus } from "@zenith/db";

export interface CalendarContentItem {
  id: string;
  title: string;
  status: ContentStatus;
  channel: ContentChannel;
  scheduledDateISO: string | null;
  client: { name: string };
}

const PENDING_STATUSES: ContentStatus[] = [
  "IDEIA",
  "PAUTA",
  "PRODUCAO",
  "REVISAO_INTERNA",
  "AGUARDANDO_CLIENTE",
  "AJUSTES",
  "APROVADO",
];

function isPending(status: ContentStatus) {
  return PENDING_STATUSES.includes(status);
}

export function InteractiveContentCalendar({
  year,
  month,
  monthItems,
  pendingItems,
}: {
  year: number;
  month: number;
  monthItems: CalendarContentItem[];
  pendingItems: CalendarContentItem[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"grade" | "lista">("grade");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { cells } = buildMonthCells(year, month);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, CalendarContentItem[]>();
    for (const item of monthItems) {
      if (!item.scheduledDateISO) continue;
      const day = new Date(item.scheduledDateISO).getUTCDate();
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return map;
  }, [monthItems]);

  const sortedPending = useMemo(
    () =>
      [...pendingItems].sort((a, b) => {
        const aTime = a.scheduledDateISO ? new Date(a.scheduledDateISO).getTime() : Infinity;
        const bTime = b.scheduledDateISO ? new Date(b.scheduledDateISO).getTime() : Infinity;
        return aTime - bTime;
      }),
    [pendingItems],
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  async function markAsScheduled(item: CalendarContentItem) {
    if (item.status !== "APROVADO" || busyId) return;
    setError(null);
    setBusyId(item.id);
    const response = await fetch(`/api/content/${item.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "AGENDADO" }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível marcar como agendado.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="relative flex items-center gap-1 rounded-lg border border-[#E4E7EC] bg-white p-1">
          <motion.div
            className="absolute h-7 w-8 rounded-md bg-[#FF2B00]"
            style={{ top: 4, left: 4 }}
            animate={{ x: view === "grade" ? 0 : 36 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
          />
          <button
            type="button"
            onClick={() => setView("grade")}
            aria-pressed={view === "grade"}
            title="Grade do mês"
            className={`relative z-[1] flex h-7 w-8 items-center justify-center rounded-md transition-colors ${
              view === "grade" ? "text-white" : "text-[#667085]"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("lista")}
            aria-pressed={view === "lista"}
            title="Pendentes de agendar/fazer"
            className={`relative z-[1] flex h-7 w-8 items-center justify-center rounded-md transition-colors ${
              view === "lista" ? "text-white" : "text-[#667085]"
            }`}
          >
            <ListChecks className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white">
        <AnimatePresence mode="wait" initial={false}>
          {view === "grade" ? (
            <motion.div
              key="grade"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
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
                  const pendingCount = dayItems.filter((item) => isPending(item.status)).length;
                  const cellKey = day ? new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10) : null;
                  const isToday = cellKey === todayKey;
                  return (
                    <div
                      key={idx}
                      className={`relative min-h-[110px] border-b border-r border-[#EEF0F3] p-2 align-top transition-colors hover:bg-[#FFF7F5] ${
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
                          <div className="flex flex-col gap-1">
                            {dayItems.map((item) => (
                              <Link
                                key={item.id}
                                href={`/conteudo/${item.id}`}
                                className={`block truncate rounded px-1.5 py-1 text-xs font-medium ${CONTENT_CALENDAR_BUCKET_CLASS[contentCalendarBucket(item.status)]}`}
                                title={`${item.title} · ${item.client.name} · ${CONTENT_CHANNEL_LABELS[item.channel]} · ${CONTENT_STATUS_LABELS[item.status]}`}
                              >
                                {item.title}
                              </Link>
                            ))}
                          </div>
                          {pendingCount > 0 && (
                            <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#344054] text-[10px] font-bold text-white">
                              {pendingCount}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lista"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex max-h-[660px] min-h-[300px] flex-col overflow-y-auto"
            >
              {sortedPending.length === 0 ? (
                <p className="p-6 text-center text-sm text-[#667085]">
                  Nenhuma peça pendente de agendamento ou produção.
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {sortedPending.map((item) => {
                    const canSchedule = item.status === "APROVADO";
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-3 border-b border-[#EEF0F3] px-4 py-3 last:border-b-0"
                      >
                        <button
                          type="button"
                          disabled={!canSchedule || busyId === item.id}
                          onClick={() => void markAsScheduled(item)}
                          title={canSchedule ? "Marcar como agendado" : "Aprove o conteúdo antes de agendar"}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            canSchedule
                              ? "border-[#D0D5DD] hover:border-[#FF2B00] hover:bg-[#FFF1EC]"
                              : "cursor-not-allowed border-[#EAECF0] bg-[#F9FAFB]"
                          }`}
                        >
                          {busyId === item.id ? (
                            <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF2B00]" />
                          ) : (
                            <Check className={`h-3.5 w-3.5 ${canSchedule ? "text-[#344054]" : "text-[#D0D5DD]"}`} />
                          )}
                        </button>
                        <Link href={`/conteudo/${item.id}`} className="flex flex-1 flex-col gap-0.5 truncate">
                          <span className="truncate text-sm font-medium text-[#101828]">{item.title}</span>
                          <span className="truncate text-xs text-[#667085]">
                            {item.client.name} · {CONTENT_CHANNEL_LABELS[item.channel]}
                            {item.scheduledDateISO
                              ? ` · ${new Date(item.scheduledDateISO).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  timeZone: "UTC",
                                })}`
                              : " · sem data"}
                          </span>
                        </Link>
                        <span
                          className={`shrink-0 rounded px-1.5 py-1 text-[11px] font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
                        >
                          {CONTENT_STATUS_LABELS[item.status]}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
              {error && <p className="px-4 py-2 text-xs font-medium text-[#D94343]">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
