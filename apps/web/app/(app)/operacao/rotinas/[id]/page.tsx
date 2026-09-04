import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { ROUTINE_STATUS_LABELS, ROUTINE_RUN_STATUS_LABELS, formatPeriodLabel } from "@/lib/routines";
import { prisma } from "@zenith/db";
import { RoutineActions } from "./RoutineActions";

interface PageProps {
  params: { id: string };
}

const RUN_STATUS_BADGE_CLASS: Record<string, string> = {
  AGENDADA: "bg-[#F2F4F7] text-[#475467]",
  CRIADA: "bg-[#DCFCE7] text-[#166534]",
  IGNORADA: "bg-[#F2F4F7] text-[#98A2B3]",
  FALHOU: "bg-[#FEE4E2] text-[#B42318]",
};

export default async function RoutineDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const routine = await prisma.routineTemplate.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      tasks: { orderBy: { order: "asc" } },
      runs: { orderBy: { period: "desc" } },
    },
  });

  if (!routine || routine.agencyId !== membership.agencyId) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{routine.name}</h1>
          <p className="text-sm text-[#667085]">
            {routine.client ? (
              <Link href={`/clientes/${routine.client.id}`} className="text-[#6847F5] hover:underline">
                {routine.client.name}
              </Link>
            ) : (
              "Rotina interna"
            )}
            {` · todo dia ${routine.dayOfMonth} · `}
            {ROUTINE_STATUS_LABELS[routine.status]}
          </p>
        </div>
        <RoutineActions routineId={routine.id} status={routine.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Tarefas geradas todo período</h2>
          <div className="flex flex-col gap-2">
            {routine.tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                <p className="text-sm font-medium text-[#101828]">{task.title}</p>
                {task.description && <p className="text-xs text-[#98A2B3]">{task.description}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Gerações</h2>
          {routine.runs.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">Nenhuma geração ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {routine.runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[#101828]">
                      {formatPeriodLabel(run.period)}
                    </p>
                    {run.projectId && (
                      <Link
                        href={`/operacao/projetos/${run.projectId}`}
                        className="text-xs text-[#6847F5] hover:underline"
                      >
                        ver projeto
                      </Link>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${RUN_STATUS_BADGE_CLASS[run.status]}`}
                  >
                    {ROUTINE_RUN_STATUS_LABELS[run.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
