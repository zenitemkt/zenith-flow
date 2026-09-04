import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { ROUTINE_STATUS_LABELS } from "@/lib/routines";
import { prisma } from "@zenith/db";
import { NewRoutineModal } from "./NewRoutineModal";

const STATUS_BADGE_CLASS: Record<string, string> = {
  RASCUNHO: "bg-[#F2F4F7] text-[#475467]",
  ATIVO: "bg-[#DCFCE7] text-[#166534]",
  PAUSADO: "bg-[#FEF3C7] text-[#92600A]",
  ARQUIVADO: "bg-[#F2F4F7] text-[#98A2B3]",
};

export default async function RotinasPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [routines, clients] = await Promise.all([
    prisma.routineTemplate.findMany({
      where: { agencyId: membership.agencyId },
      include: { client: { select: { name: true } }, _count: { select: { tasks: true, runs: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Rotinas recorrentes</h1>
          <p className="text-sm text-[#667085]">
            {routines.length} rotina{routines.length === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewRoutineModal clients={clients} />
      </div>

      {routines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhuma rotina ainda. Crie uma para gerar tarefas automaticamente todo mês.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((routine) => (
            <Link
              key={routine.id}
              href={`/operacao/rotinas/${routine.id}`}
              className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
            >
              <p className="font-medium text-[#101828]">{routine.name}</p>
              <p className="mt-1 text-sm text-[#667085]">
                {routine.client?.name ?? "Interna"} · todo dia {routine.dayOfMonth}
              </p>
              <p className="mt-1 text-xs text-[#98A2B3]">
                {routine._count.tasks} tarefa{routine._count.tasks === 1 ? "" : "s"} ·{" "}
                {routine._count.runs} geraç{routine._count.runs === 1 ? "ão" : "ões"}
              </p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[routine.status]}`}
              >
                {ROUTINE_STATUS_LABELS[routine.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
