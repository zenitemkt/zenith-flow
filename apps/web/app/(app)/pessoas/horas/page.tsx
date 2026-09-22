import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import {
  TIMESHEET_STATUS_LABELS,
  TIMESHEET_STATUS_TRANSITIONS,
  startOfWeekUTC,
  formatMinutes,
} from "@/lib/timesheets";
import { prisma } from "@zenite-mkt/db";
import { NewTimeEntryForm } from "./NewTimeEntryForm";
import { TimerWidget } from "./TimerWidget";
import { TimeEntryRow } from "./TimeEntryRow";
import { TimesheetStatusActions } from "./TimesheetStatusActions";

interface PageProps {
  searchParams: { week?: string };
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ENVIADA: "bg-[#EEF2FF] text-[#3730A3]",
  APROVADA: "bg-[#DCFCE7] text-[#166534]",
  CORRIGIDA: "bg-[#FEE4E2] text-[#B42318]",
};

export default async function HorasPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const requestedWeek = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = startOfWeekUTC(isNaN(requestedWeek.getTime()) ? new Date() : requestedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const prevWeek = new Date(weekStart);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const [timesheet, myTasks] = await Promise.all([
    prisma.timesheet.findUnique({
      where: { userId_weekStart: { userId: session.user.id, weekStart } },
      include: {
        entries: { orderBy: { date: "asc" }, include: { task: { select: { title: true } }, edits: true } },
      },
    }),
    prisma.task.findMany({
      where: { project: { agencyId: membership.agencyId }, assigneeUserId: session.user.id },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const entries = timesheet?.entries ?? [];
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const status = timesheet?.status ?? "RASCUNHO";
  const locked = status === "ENVIADA" || status === "APROVADA";
  const transitions = timesheet
    ? TIMESHEET_STATUS_TRANSITIONS[status].filter((s) => s !== "APROVADA" && s !== "CORRIGIDA")
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Minhas horas</h1>
          <p className="text-sm text-[#667085]">
            Semana de {weekStart.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a{" "}
            {weekEnd.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {formatMinutes(totalMinutes)} apontados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/pessoas/horas?week=${prevWeek.toISOString().slice(0, 10)}`}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            ← Semana anterior
          </Link>
          <Link
            href={`/pessoas/horas?week=${nextWeek.toISOString().slice(0, 10)}`}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Próxima semana →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Cronômetro</h2>
            <TimerWidget tasks={myTasks} />
          </section>

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Apontar manualmente</h2>
            <NewTimeEntryForm tasks={myTasks} defaultDate={new Date().toISOString().slice(0, 10)} />
          </section>
        </div>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#101828]">Esta semana</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
              {TIMESHEET_STATUS_LABELS[status]}
            </span>
          </div>
          <div className="mb-4 flex flex-col gap-2">
            {entries.length === 0 && <p className="text-sm text-[#98A2B3]">Nenhum apontamento nesta semana.</p>}
            {entries.map((entry) => (
              <TimeEntryRow
                key={entry.id}
                id={entry.id}
                date={entry.date.toISOString()}
                minutes={entry.minutes}
                description={entry.description}
                taskTitle={entry.task?.title ?? null}
                edited={entry.edits.length > 0}
                needsReason={locked}
                locked={locked}
              />
            ))}
          </div>
          {timesheet && entries.length > 0 && (
            <TimesheetStatusActions timesheetId={timesheet.id} options={transitions} />
          )}
        </section>
      </div>
    </div>
  );
}
