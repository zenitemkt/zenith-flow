import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { getAgencyMembers } from "@/lib/team";
import { canManageAnyTask } from "@/lib/rbac";
import { getOrCreateDefaultOperationStage } from "@/lib/operation-stages";
import { ClientFilterPills } from "@/app/_components/ClientFilterPills";
import { prisma } from "@zenith/db";
import { OperationBoard, type BoardTask, type PersonOption, type StageOption } from "./OperationBoard";
import { NewTaskModal } from "./NewTaskModal";

interface PageProps {
  searchParams: { clientId?: string };
}

export default async function OperacaoPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const activeClientId = searchParams.clientId;

  await getOrCreateDefaultOperationStage(prisma, membership.agencyId);

  const [people, clients, stagesRaw, tasksRaw] = await Promise.all([
    getAgencyMembers(membership.agencyId),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.operationStage.findMany({ where: { agencyId: membership.agencyId }, orderBy: { order: "asc" } }),
    prisma.task.findMany({
      where: {
        project: {
          agencyId: membership.agencyId,
          ...(activeClientId ? { clientId: activeClientId } : {}),
        },
        status: { in: ["BACKLOG", "PLANEJADA", "EM_ANDAMENTO", "BLOQUEADA", "REVISAO", "CONCLUIDA"] },
      },
      include: {
        project: { include: { client: { select: { id: true, name: true } } } },
        blockedBy: { select: { id: true, title: true, status: true } },
        assignees: { orderBy: { order: "asc" } },
        checklistItems: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const userNameById = new Map(people.map((p) => [p.userId, p.name]));
  const firstStageId = stagesRaw[0]?.id ?? null;

  const tasks: BoardTask[] = tasksRaw.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    stageId: task.status === "EM_ANDAMENTO" ? (task.stageId ?? firstStageId) : task.stageId,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    estimatedMinutes: task.estimatedMinutes,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    clientId: task.project.client?.id ?? null,
    clientName: task.project.client?.name ?? null,
    assigneeUserId: task.assigneeUserId,
    blockedBy: task.blockedBy,
    assignees: task.assignees.map((a) => ({
      userId: a.userId,
      name: userNameById.get(a.userId) ?? "Ex-membro",
      order: a.order,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    })),
    checklistItems: task.checklistItems.map((c) => ({ id: c.id, title: c.title, done: c.done })),
  }));

  const personOptions: PersonOption[] = people.map((p) => ({ userId: p.userId, name: p.name }));
  const stages: StageOption[] = stagesRaw.map((s) => ({ id: s.id, name: s.name, order: s.order }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Operação</h1>
          <p className="text-sm text-[#667085]">
            {tasks.filter((t) => t.status !== "CONCLUIDA").length} tarefa
            {tasks.filter((t) => t.status !== "CONCLUIDA").length === 1 ? "" : "s"} em aberto em{" "}
            {membership.agency.name}.
          </p>
        </div>
        <NewTaskModal clients={clients} people={personOptions} allTasks={tasks} />
      </div>

      <ClientFilterPills
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) => (clientId ? `/operacao?clientId=${clientId}` : "/operacao")}
      />

      <OperationBoard
        tasks={tasks}
        people={personOptions}
        stages={stages}
        currentUserId={session.user.id}
        canManageAnyTask={canManageAnyTask(membership.role)}
      />
    </div>
  );
}
