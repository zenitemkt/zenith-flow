import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE_CLASS } from "@/lib/campaigns";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenith/db";
import { NewCampaignModal } from "./NewCampaignModal";

export default async function CampaignsPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [campaigns, clients] = await Promise.all([
    prisma.campaign.findMany({
      where: { agencyId: membership.agencyId },
      include: { client: { select: { id: true, name: true } } },
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
          <h1 className="text-lg font-semibold text-[#101828]">Campanhas</h1>
          <p className="text-sm text-[#667085]">
            {campaigns.length} campanha{campaigns.length === 1 ? "" : "s"} em {membership.agency.name} (seção 36 do
            manual) — sem conector externo ainda, cadastro e métricas são manuais.
          </p>
        </div>
        <NewCampaignModal clients={clients} />
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma campanha ainda. Crie a primeira.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Campanha</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Orçamento</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/comercial/campanhas/${campaign.id}`}
                      className="font-medium text-[#101828] hover:text-[#FF2B00]"
                    >
                      {campaign.name}
                    </Link>
                    {campaign.utmCampaign && (
                      <span className="ml-2 text-xs text-[#98A2B3]">utm_campaign={campaign.utmCampaign}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#475467]">{campaign.client?.name ?? "Própria agência"}</td>
                  <td className="px-4 py-3 text-[#475467]">{campaign.channel}</td>
                  <td className="px-4 py-3 text-[#475467]">
                    {campaign.startDate ? campaign.startDate.toLocaleDateString("pt-BR") : "—"}
                    {campaign.endDate ? ` – ${campaign.endDate.toLocaleDateString("pt-BR")}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[#475467]">
                    {campaign.budgetCents !== null ? formatCents(campaign.budgetCents) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_BADGE_CLASS[campaign.status]}`}
                    >
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
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
