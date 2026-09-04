import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { getAgencyMembers } from "@/lib/team";
import { WORK_ITEM_STATUS_LABELS } from "@/lib/tasks";
import { prisma } from "@zenith/db";
import { NewTaskModal } from "./NewTaskModal";
import { TaskBoard } from "./TaskBoard";

interface PageProps {
  params: { id: string };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      tasks: {
        orderBy: { createdAt: "asc" },
        include: { blockedBy: { select: { id: true, title: true, status: true } } },
      },
    },
  });

  if (!project || project.agencyId !== membership.agencyId) {
    notFound();
  }

  const people = await getAgencyMembers(membership.agencyId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">{project.name}</h1>
          <p className="text-sm text-[#667085]">
            {project.client ? (
              <Link href={`/clientes/${project.client.id}`} className="text-[#6847F5] hover:underline">
                {project.client.name}
              </Link>
            ) : (
              "Projeto interno"
            )}
            {" · "}
            {WORK_ITEM_STATUS_LABELS[project.status]}
          </p>
        </div>
        <NewTaskModal
          projectId={project.id}
          existingTasks={project.tasks.map((t) => ({ id: t.id, title: t.title }))}
          people={people}
        />
      </div>

      {project.tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma tarefa ainda. Crie a primeira.</p>
        </div>
      ) : (
        <TaskBoard
          tasks={project.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            assigneeUserId: t.assigneeUserId,
            blockedBy: t.blockedBy,
          }))}
          people={people}
        />
      )}
    </div>
  );
}
