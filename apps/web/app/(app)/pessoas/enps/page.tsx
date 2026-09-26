import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam, canViewEnps } from "@/lib/rbac";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { ENPS_STATUS_LABELS, ENPS_STATUS_BADGE_CLASS } from "@/lib/enps";
import { prisma } from "@zenite-mkt/db";
import { NewEnpsCampaignModal } from "./NewEnpsCampaignModal";

export default async function EnpsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }
  if (!canViewEnps(membership.role)) {
    redirect("/pessoas/equipe");
  }

  const canDelete = canManageTeam(membership.role);
  const [campaigns, employees] = await Promise.all([
    prisma.enpsCampaign.findMany({
      where: { agencyId: membership.agencyId },
      include: {
        _count: { select: { invites: true } },
        snapshots: { orderBy: { computedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employee.findMany({
      where: { agencyId: membership.agencyId, status: "ATIVO" },
      include: { user: { select: { email: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    name: e.name,
    eligible: Boolean(e.email ?? e.user?.email),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">eNPS</h1>
          <p className="text-sm text-[#667085]">
            Pesquisas anônimas de satisfação da equipe (seção 32.1). Acesso restrito.
          </p>
        </div>
        <NewEnpsCampaignModal employees={employeeOptions} />
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma pesquisa ainda. Crie a primeira.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Pesquisa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Convidados</th>
                <th className="px-4 py-3">eNPS</th>
                {canDelete && <th className="w-14 px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/pessoas/enps/${campaign.id}`} className="font-medium text-[#101828] hover:text-[#FF2B00]">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ENPS_STATUS_BADGE_CLASS[campaign.status]}`}
                    >
                      {ENPS_STATUS_LABELS[campaign.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{campaign._count.invites}</td>
                  <td className="px-4 py-3 text-[#475467]">
                    {campaign.snapshots[0] ? campaign.snapshots[0].score : "—"}
                  </td>
                  {canDelete && <td className="px-4 py-3 text-right"><DeleteRecordButton endpoint={`/api/enps/campaigns/${campaign.id}`} recordName={campaign.name} entityLabel="Pesquisa de eNPS" warning="Convites, respostas anônimas e resultados históricos também serão removidos." /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
