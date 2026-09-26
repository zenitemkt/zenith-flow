import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { prisma } from "@zenite-mkt/db";
import { InviteMemberForm } from "./InviteMemberForm";
import { MembersTable } from "./MembersTable";

export default async function EquipePage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const members = await prisma.membership.findMany({
    where: { workspaceId: membership.workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const canManage = canManageTeam(membership.role);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Equipe e permissões</h1>
        <p className="text-sm text-[#667085]">
          Membros de <strong>{membership.agency.name}</strong> e o papel de cada um. Clique em uma linha para ver
          detalhes, alterar papel, (in)ativar ou excluir o cadastro.
        </p>
      </div>

      {canManage && <InviteMemberForm />}

      <MembersTable
        canManage={canManage}
        members={members.map((member) => ({
          id: member.id,
          name: member.user?.name ?? null,
          email: member.email,
          role: member.role,
          status: member.status,
          createdAt: member.createdAt.toISOString(),
          isSelf: member.userId === session.user.id,
        }))}
      />
    </div>
  );
}
