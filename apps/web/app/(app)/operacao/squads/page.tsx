import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenith/db";
import { NewSquadModal } from "./NewSquadModal";

export default async function SquadsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const squads = await prisma.squad.findMany({
    where: { agencyId: membership.agencyId },
    include: {
      _count: { select: { members: true } },
      allocations: { where: { status: "ATIVA" }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Squads</h1>
          <p className="text-sm text-[#667085]">
            {squads.length} squad{squads.length === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewSquadModal />
      </div>

      {squads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhum squad ainda. Crie um para organizar quem atende cada cliente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {squads.map((squad) => (
            <Link
              key={squad.id}
              href={`/operacao/squads/${squad.id}`}
              className="rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#6847F5]"
            >
              <p className="font-medium text-[#101828]">{squad.name}</p>
              <p className="mt-1 text-sm text-[#667085]">
                {squad._count.members} pessoa{squad._count.members === 1 ? "" : "s"} ·{" "}
                {squad.allocations.length} cliente{squad.allocations.length === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
