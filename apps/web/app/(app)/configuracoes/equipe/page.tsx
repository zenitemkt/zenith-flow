import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam, ROLE_LABELS } from "@/lib/rbac";
import { prisma } from "@zenith/db";
import { InviteMemberForm } from "./InviteMemberForm";

const STATUS_LABELS: Record<string, string> = {
  INVITED: "Convite pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  EXPIRED: "Expirado",
};

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Equipe e permissões</h1>
        <p className="text-sm text-[#667085]">
          Membros de <strong>{membership.agency.name}</strong> e o papel de cada um.
        </p>
      </div>

      {canManageTeam(membership.role) && <InviteMemberForm />}

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-[#EEF0F3]">
                <td className="px-4 py-3 font-medium text-[#101828]">
                  {member.user?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-[#475467]">{member.email}</td>
                <td className="px-4 py-3 text-[#475467]">{ROLE_LABELS[member.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      member.status === "ACTIVE"
                        ? "rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]"
                        : "rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92600A]"
                    }
                  >
                    {STATUS_LABELS[member.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
