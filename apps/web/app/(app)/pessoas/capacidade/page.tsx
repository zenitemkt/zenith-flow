import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canApproveTimesheets } from "@/lib/rbac";
import { getAgencyMembers } from "@/lib/team";
import {
  TIMESHEET_STATUS_LABELS,
  TIMESHEET_STATUS_TRANSITIONS,
  startOfWeekUTC,
  formatMinutes,
} from "@/lib/timesheets";
import { prisma } from "@zenith/db";
import { TimesheetStatusActions } from "../horas/TimesheetStatusActions";

interface PageProps {
  searchParams: { week?: string };
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ENVIADA: "bg-[#EEF2FF] text-[#3730A3]",
  APROVADA: "bg-[#DCFCE7] text-[#166534]",
  CORRIGIDA: "bg-[#FEE4E2] text-[#B42318]",
};

export default async function CapacidadePage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }
  if (!canApproveTimesheets(membership.role)) {
    redirect("/pessoas/horas");
  }

  const requestedWeek = searchParams.week ? new Date(searchParams.week) : new Date();
  const weekStart = startOfWeekUTC(isNaN(requestedWeek.getTime()) ? new Date() : requestedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const prevWeek = new Date(weekStart);
  prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const [members, timesheets, minutesByUser, tasksWithEstimate] = await Promise.all([
    getAgencyMembers(membership.agencyId),
    prisma.timesheet.findMany({ where: { agencyId: membership.agencyId, weekStart } }),
    prisma.timeEntry.groupBy({
      by: ["userId"],
      where: { agencyId: membership.agencyId, date: { gte: weekStart, lt: weekEnd } },
      _sum: { minutes: true },
    }),
    prisma.task.findMany({
      where: { project: { agencyId: membership.agencyId }, estimatedMinutes: { not: null } },
      select: {
        id: true,
        estimatedMinutes: true,
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
      },
    }),
  ]);

  const timesheetByUser = new Map(timesheets.map((t) => [t.userId, t]));
  const minutesMap = new Map(minutesByUser.map((row) => [row.userId, row._sum.minutes ?? 0]));

  const realizedByTaskId = await prisma.timeEntry.groupBy({
    by: ["taskId"],
    where: { agencyId: membership.agencyId, taskId: { in: tasksWithEstimate.map((t) => t.id) } },
    _sum: { minutes: true },
  });
  const realizedMap = new Map(realizedByTaskId.map((row) => [row.taskId, row._sum.minutes ?? 0]));

  const byProject = new Map<string, { name: string; client: string; estimated: number; realized: number }>();
  for (const task of tasksWithEstimate) {
    const key = task.project.id;
    const current = byProject.get(key) ?? {
      name: task.project.name,
      client: task.project.client?.name ?? "Interno",
      estimated: 0,
      realized: 0,
    };
    current.estimated += task.estimatedMinutes ?? 0;
    current.realized += realizedMap.get(task.id) ?? 0;
    byProject.set(key, current);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Capacidade</h1>
          <p className="text-sm text-[#667085]">
            Semana de {weekStart.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/pessoas/capacidade?week=${prevWeek.toISOString().slice(0, 10)}`}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            ← Anterior
          </Link>
          <Link
            href={`/pessoas/capacidade?week=${nextWeek.toISOString().slice(0, 10)}`}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Próxima →
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">Horas por pessoa</h2>
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Pessoa</th>
                <th className="px-4 py-3">Horas apontadas</th>
                <th className="px-4 py-3">Folha</th>
                <th className="px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const sheet = timesheetByUser.get(member.userId);
                const minutes = minutesMap.get(member.userId) ?? 0;
                const status = sheet?.status ?? "RASCUNHO";
                const managerOptions = sheet
                  ? TIMESHEET_STATUS_TRANSITIONS[status].filter((s) => s === "APROVADA" || s === "CORRIGIDA")
                  : [];
                return (
                  <tr key={member.userId} className="border-t border-[#EEF0F3]">
                    <td className="px-4 py-3 font-medium text-[#101828]">{member.name}</td>
                    <td className="px-4 py-3 text-[#475467]">{formatMinutes(minutes)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                        {TIMESHEET_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sheet && managerOptions.length > 0 ? (
                        <TimesheetStatusActions timesheetId={sheet.id} options={managerOptions} />
                      ) : (
                        <span className="text-xs text-[#98A2B3]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">Estimado × realizado por projeto</h2>
        {byProject.size === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center">
            <p className="text-sm text-[#667085]">Nenhuma tarefa com estimativa ainda.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3">Projeto</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Estimado</th>
                  <th className="px-4 py-3">Realizado</th>
                  <th className="px-4 py-3">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(byProject.entries()).map(([id, row]) => {
                  const diff = row.realized - row.estimated;
                  return (
                    <tr key={id} className="border-t border-[#EEF0F3]">
                      <td className="px-4 py-3 font-medium text-[#101828]">{row.name}</td>
                      <td className="px-4 py-3 text-[#475467]">{row.client}</td>
                      <td className="px-4 py-3 text-[#475467]">{formatMinutes(row.estimated)}</td>
                      <td className="px-4 py-3 text-[#475467]">{formatMinutes(row.realized)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            diff > 0 ? "bg-[#FEE4E2] text-[#B42318]" : "bg-[#DCFCE7] text-[#166534]"
                          }`}
                        >
                          {diff > 0 ? "+" : ""}
                          {formatMinutes(Math.abs(diff))} {diff > 0 ? "acima" : "abaixo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
