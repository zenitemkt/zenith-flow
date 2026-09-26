import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { SURVEY_STATUS_LABELS, SURVEY_STATUS_BADGE_CLASS } from "@/lib/nps";
import { prisma } from "@zenite-mkt/db";
import { NewSurveyModal } from "./NewSurveyModal";

export default async function NpsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const canDelete = canManageTeam(membership.role);
  const [campaigns, clients] = await Promise.all([
    prisma.surveyCampaign.findMany({
      where: { agencyId: membership.agencyId },
      include: {
        _count: { select: { recipients: true } },
        npsSnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId, status: { in: ["ATIVO", "REATIVADO"] } },
      include: { contacts: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: c.name,
    eligible: c.contacts.some((contact) => contact.email && !contact.marketingOptOut),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">NPS</h1>
          <p className="text-sm text-[#667085]">
            Pesquisas de satisfação de {membership.agency.name} (seção 32.1 do manual).
          </p>
        </div>
        <NewSurveyModal clients={clientOptions} />
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
                <th className="px-4 py-3">Destinatários</th>
                <th className="px-4 py-3">NPS</th>
                {canDelete && <th className="w-14 px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/nps/${campaign.id}`} className="font-medium text-[#101828] hover:text-[#FF2B00]">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${SURVEY_STATUS_BADGE_CLASS[campaign.status]}`}
                    >
                      {SURVEY_STATUS_LABELS[campaign.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{campaign._count.recipients}</td>
                  <td className="px-4 py-3 text-[#475467]">
                    {campaign.npsSnapshots[0] ? campaign.npsSnapshots[0].score : "—"}
                  </td>
                  {canDelete && <td className="px-4 py-3 text-right"><DeleteRecordButton endpoint={`/api/nps/campaigns/${campaign.id}`} recordName={campaign.name} entityLabel="Pesquisa de NPS" warning="Destinatários, respostas e resultados históricos também serão removidos." /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
