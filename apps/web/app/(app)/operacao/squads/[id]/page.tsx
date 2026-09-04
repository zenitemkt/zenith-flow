import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { getAgencyMembers } from "@/lib/team";
import { prisma } from "@zenith/db";
import { AddMemberForm } from "./AddMemberForm";
import { AllocateClientForm } from "./AllocateClientForm";

interface PageProps {
  params: { id: string };
}

const OPEN_TASK_STATUSES = ["BACKLOG", "PLANEJADA", "EM_ANDAMENTO", "BLOQUEADA", "REVISAO"] as const;

export default async function SquadDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const squad = await prisma.squad.findUnique({
    where: { id: params.id },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      allocations: { where: { status: "ATIVA" }, include: { client: true } },
    },
  });

  if (!squad || squad.agencyId !== membership.agencyId) {
    notFound();
  }

  const now = new Date();
  const [agencyMembers, clients, workloadCounts, activeLeaves] = await Promise.all([
    getAgencyMembers(membership.agencyId),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      orderBy: { name: "asc" },
    }),
    prisma.task.groupBy({
      by: ["assigneeUserId"],
      where: {
        project: { agencyId: membership.agencyId },
        assigneeUserId: { not: null },
        status: { in: [...OPEN_TASK_STATUSES] },
      },
      _count: { _all: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        agencyId: membership.agencyId,
        status: "APROVADA",
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { employee: { select: { userId: true } } },
    }),
  ]);

  const workloadByUserId = new Map(workloadCounts.map((row) => [row.assigneeUserId, row._count._all]));
  const leaveEndByUserId = new Map(
    activeLeaves.filter((l) => l.employee.userId).map((l) => [l.employee.userId as string, l.endDate]),
  );
  const currentMemberUserIds = new Set(squad.members.map((m) => m.userId));
  const memberOptions = agencyMembers.filter((m) => !currentMemberUserIds.has(m.userId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">{squad.name}</h1>
        <p className="text-sm text-[#667085]">
          {squad.members.length} pessoa{squad.members.length === 1 ? "" : "s"} ·{" "}
          {squad.allocations.length} cliente{squad.allocations.length === 1 ? "" : "s"} atendido
          {squad.allocations.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Membros e carga</h2>
          <div className="mb-4 flex flex-col gap-2">
            {squad.members.length === 0 && (
              <p className="text-sm text-[#98A2B3]">Nenhum membro ainda.</p>
            )}
            {squad.members.map((member) => {
              const load = workloadByUserId.get(member.userId) ?? 0;
              const leaveEnd = leaveEndByUserId.get(member.userId);
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
                >
                  <span className="text-sm font-medium text-[#101828]">{member.user.name}</span>
                  <div className="flex items-center gap-1.5">
                    {leaveEnd && (
                      <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]">
                        Afastado até {leaveEnd.toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        load >= 8
                          ? "bg-[#FEE4E2] text-[#B42318]"
                          : load >= 4
                            ? "bg-[#FEF3C7] text-[#92600A]"
                            : "bg-[#F2F4F7] text-[#475467]"
                      }`}
                    >
                      {load} tarefa{load === 1 ? "" : "s"} aberta{load === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <AddMemberForm squadId={squad.id} options={memberOptions} />
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Clientes atendidos</h2>
          <div className="mb-4 flex flex-col gap-2">
            {squad.allocations.length === 0 && (
              <p className="text-sm text-[#98A2B3]">Nenhum cliente alocado ainda.</p>
            )}
            {squad.allocations.map((allocation) => (
              <Link
                key={allocation.id}
                href={`/clientes/${allocation.client.id}`}
                className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2 hover:border-[#6847F5]"
              >
                <span className="text-sm font-medium text-[#101828]">{allocation.client.name}</span>
                <span className="text-xs text-[#98A2B3]">
                  responsável desde {allocation.startDate.toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </div>
          <AllocateClientForm
            squadId={squad.id}
            options={clients.map((c) => ({ id: c.id, name: c.name }))}
          />
        </section>
      </div>
    </div>
  );
}
