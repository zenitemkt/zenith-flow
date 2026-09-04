import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { WORK_ITEM_STATUS_LABELS } from "@/lib/tasks";
import { prisma } from "@zenith/db";
import { NewProjectModal } from "./NewProjectModal";

export default async function ProjetosPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { agencyId: membership.agencyId },
      include: { client: { select: { name: true } }, _count: { select: { tasks: true } } },
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
          <h1 className="text-lg font-semibold text-[#101828]">Projetos</h1>
          <p className="text-sm text-[#667085]">
            {projects.length} projeto{projects.length === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewProjectModal clients={clients} />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhum projeto ainda. Crie um para começar a distribuir tarefas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/operacao/projetos/${project.id}`}
              className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
            >
              <p className="font-medium text-[#101828]">{project.name}</p>
              <p className="mt-1 text-sm text-[#667085]">
                {project.client?.name ?? "Interno"} · {project._count.tasks} tarefa
                {project._count.tasks === 1 ? "" : "s"}
              </p>
              <span className="mt-2 inline-block rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#475467]">
                {WORK_ITEM_STATUS_LABELS[project.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
