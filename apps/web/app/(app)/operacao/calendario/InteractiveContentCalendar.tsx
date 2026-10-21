"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Facebook, Instagram, LayoutGrid, ListChecks, Check, Clock, CalendarDays, CheckCircle2, Plus } from "lucide-react";
import { WEEKDAY_LABELS, buildMonthCells } from "@/lib/content-calendar";
import {
  CONTENT_CALENDAR_BUCKET_CLASS,
  CONTENT_CHANNEL_LABELS,
  CONTENT_STATUS_BADGE_CLASS,
  CONTENT_STATUS_LABELS,
  contentCalendarBucket,
  type ContentCalendarBucket,
} from "@/lib/content";
import type { ContentChannel, ContentStatus } from "@zenite-mkt/db";
import { QuickPostModal, todaySP, type QuickPostClient } from "./QuickPostModal";

const CALENDAR_BUCKET_ICON: Record<ContentCalendarBucket, typeof Clock | null> = {
  neutral: null,
  aguardando_aprovacao: Clock,
  agenda: CalendarDays,
  concluido: CheckCircle2,
};

/** Publicação agendada/publicada nas redes (agendador, 2026-10-20). */
export interface CalendarSocialPost {
  id: string;
  contentItemId: string | null;
  title: string;
  clientName: string;
  platform: "INSTAGRAM" | "FACEBOOK" | "GOOGLE_BUSINESS";
  status: "SCHEDULED" | "PUBLISHING" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELED";
  publishAtISO: string;
}

const POST_STATUS_CLASS: Record<CalendarSocialPost["status"], string> = {
  SCHEDULED: "border-[#2E90FA]/40 bg-[#EEF4FF] text-[#2859B8]",
  PUBLISHING: "border-[#F79009]/40 bg-[#FEF3C7] text-[#92600A]",
  PROCESSING: "border-[#F79009]/40 bg-[#FEF3C7] text-[#92600A]",
  PUBLISHED: "border-[#16A36A]/40 bg-[#DCFCE7] text-[#166534]",
  FAILED: "border-[#D94343]/40 bg-[#FEE4E2] text-[#B42318]",
  CANCELED: "border-[#E4E7EC] bg-[#F2F4F7] text-[#667085]",
};
const POST_STATUS_LABEL: Record<CalendarSocialPost["status"], string> = {
  SCHEDULED: "agendado",
  PUBLISHING: "publicando",
  PROCESSING: "processando",
  PUBLISHED: "publicado",
  FAILED: "falhou",
  CANCELED: "cancelado",
};

/** Dia (1-31) e hora "HH:MM" do instante no fuso de São Paulo. */
function spDayAndTime(iso: string): { day: number; month: number; time: string } {
  const shifted = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return { day: shifted.getUTCDate(), month: shifted.getUTCMonth(), time: shifted.toISOString().slice(11, 16) };
}

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
  posts = [],
  quickPostClients = [],
  activeClientId,
}: {
  year: number;
  month: number;
  monthItems: CalendarContentItem[];
  pendingItems: CalendarContentItem[];
  posts?: CalendarSocialPost[];
  /** Clientes com rede conectada — publicação direta clicando no dia. */
  quickPostClients?: QuickPostClient[];
  activeClientId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"grade" | "lista">("grade");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Dia clicado (AAAA-MM-DD) com a publicação direta aberta. */
  const [quickDate, setQuickDate] = useState<string | null>(null);

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

  const postsByDay = useMemo(() => {
    const map = new Map<number, (CalendarSocialPost & { time: string })[]>();
    for (const post of posts) {
      const { day, month: postMonth, time } = spDayAndTime(post.publishAtISO);
      if (postMonth !== month) continue;
      const list = map.get(day) ?? [];
      list.push({ ...post, time });
      map.set(day, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [posts, month]);

  const sortedPending = useMemo(
    () =>
      [...pendingItems].sort((a, b) => {
        const aTime = a.scheduledDateISO ? new Date(a.scheduledDateISO).getTime() : Infinity;
        const bTime = b.scheduledDateISO ? new Date(b.scheduledDateISO).getTime() : Infinity;
        return aTime - bTime;
      }),
    [pendingItems],
  );

  // "Hoje" no fuso de São Paulo, igual ao agendador.
  const todayKey = todaySP();

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
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setQuickDate(todayKey)}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ backgroundColor: "#FF2B00" }}
        >
          <Plus size={16} aria-hidden />
          Nova publicação
        </button>
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
                  const canPost = cellKey !== null && cellKey >= todayKey;
                  return (
                    <div
                      key={idx}
                      onClick={(e) => {
                        // Clique no espaço vazio do dia abre a publicação direta (os itens têm links próprios).
                        if (canPost && !(e.target as HTMLElement).closest("a,button")) setQuickDate(cellKey);
                      }}
                      className={`group relative min-h-[110px] border-b border-r border-[#EEF0F3] p-2 align-top transition-colors hover:bg-[#FFF7F5] ${
                        day ? "bg-white" : "bg-[#FAFAFB]"
                      } ${canPost ? "cursor-pointer" : ""}`}
                    >
                      {day && (
                        <>
                          {canPost && (
                            <button
                              type="button"
                              onClick={() => setQuickDate(cellKey)}
                              title="Agendar publicação neste dia"
                              aria-label={`Agendar publicação no dia ${day}`}
                              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-[#FF2B00] text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
                            >
                              <Plus size={14} aria-hidden />
                            </button>
                          )}
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
                            {dayItems.map((item) => {
                              const bucket = contentCalendarBucket(item.status);
                              const BucketIcon = CALENDAR_BUCKET_ICON[bucket];
                              return (
                                <Link
                                  key={item.id}
                                  href={`/conteudo/${item.id}`}
                                  className={`flex items-center gap-1 truncate rounded px-1.5 py-1 text-xs font-medium ${CONTENT_CALENDAR_BUCKET_CLASS[bucket]}`}
                                  title={`${item.title} · ${item.client.name} · ${CONTENT_CHANNEL_LABELS[item.channel]} · ${CONTENT_STATUS_LABELS[item.status]}`}
                                >
                                  {BucketIcon && <BucketIcon className="h-3 w-3 shrink-0" aria-hidden />}
                                  <span className="truncate">{item.title}</span>
                                </Link>
                              );
                            })}
                            {(postsByDay.get(day) ?? []).map((post) => {
                              const PostIcon = post.platform === "INSTAGRAM" ? Instagram : Facebook;
                              const className = `flex items-center gap-1 truncate rounded border px-1.5 py-1 text-[11px] font-medium ${POST_STATUS_CLASS[post.status]}`;
                              const content = (
                                <>
                                  <span className="shrink-0 font-semibold tabular-nums">{post.time}</span>
                                  <PostIcon className="h-3 w-3 shrink-0" aria-hidden />
                                  <span className="truncate">{post.title}</span>
                                </>
                              );
                              const title = `${post.time} · ${post.platform === "INSTAGRAM" ? "Instagram" : "Facebook"} · ${post.title} · ${post.clientName} · ${POST_STATUS_LABEL[post.status]}`;
                              return post.contentItemId ? (
                                <Link key={post.id} href={`/conteudo/${post.contentItemId}`} className={className} title={title}>
                                  {content}
                                </Link>
                              ) : (
                                <span key={post.id} className={className} title={title}>
                                  {content}
                                </span>
                              );
                            })}
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

      <QuickPostModal
        open={quickDate !== null}
        onClose={() => setQuickDate(null)}
        initialDate={quickDate ?? todayKey}
        initialClientId={activeClientId}
        clients={quickPostClients}
      />
    </div>
  );
}
