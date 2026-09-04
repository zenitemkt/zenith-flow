import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { WORK_ITEM_STATUS_LABELS } from "@/lib/tasks";
import { prisma } from "@zenith/db";

const STATUS_BADGE_CLASS: Record<string, string> = {
  BACKLOG: "bg-[#F2F4F7] text-[#475467]",
  PLANEJADA: "bg-[#EEF2FF] text-[#3730A3]",
  EM_ANDAMENTO: "bg-[#FEF3C7] text-[#92600A]",
  BLOQUEADA: "bg-[#FEE4E2] text-[#B42318]",
  REVISAO: "bg-[#EEF2FF] text-[#3730A3]",
  CONCLUIDA: "bg-[#DCFCE7] text-[#166534]",
  CANCELADA: "bg-[#F2F4F7] text-[#98A2B3]",
};

export default async function TarefasPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const tasks = await prisma.task.findMany({
    where: { project: { agencyId: membership.agencyId } },
    include: { project: { include: { client: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Tarefas</h1>
        <p className="text-sm text-[#667085]">
          {tasks.length} tarefa{tasks.length === 1 ? "" : "s"} em {membership.agency.name}.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhuma tarefa ainda. Crie um projeto e adicione tarefas, ou converta uma demanda aprovada.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Tarefa</th>
                <th className="px-4 py-3">Projeto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3 font-medium text-[#101828]">{task.title}</td>
                  <td className="px-4 py-3 text-[#475467]">
                    <Link
                      href={`/operacao/projetos/${task.project.id}`}
                      className="text-[#6847F5] hover:underline"
                    >
                      {task.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">
                    {task.project.client?.name ?? <span className="text-[#98A2B3]">Interno</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[task.status]}`}
                    >
                      {WORK_ITEM_STATUS_LABELS[task.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
