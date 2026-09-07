import { requirePortalContext } from "@/lib/portal";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE_CLASS } from "@/lib/campaigns";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenith/db";

/**
 * Somente leitura — o cliente nunca cria/edita campanha nem métrica, só
 * acompanha o que a agência já cadastrou (`/comercial/campanhas`, seção 36).
 * Sem o painel "Atribuição Zenith" (isso é sobre o funil comercial da
 * própria agência, seção 39 — não faz sentido pro cliente).
 */
export default async function PortalTrafegoPage() {
  const { client } = await requirePortalContext();

  const campaigns = await prisma.campaign.findMany({
    where: { clientId: client.id },
    include: { dailyMetrics: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Tráfego pago</h1>
        <p className="text-sm text-[#667085]">Campanhas de mídia paga que a agência gerencia pra você.</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma campanha de tráfego pago cadastrada ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {campaigns.map((campaign) => {
            const totals = campaign.dailyMetrics.reduce(
              (acc, m) => ({
                spendCents: acc.spendCents + m.spendCents,
                impressions: acc.impressions + m.impressions,
                clicks: acc.clicks + m.clicks,
                results: acc.results + (m.results ?? 0),
              }),
              { spendCents: 0, impressions: 0, clicks: 0, results: 0 },
            );

            return (
              <section key={campaign.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
                      {campaign.name}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_BADGE_CLASS[campaign.status]}`}
                      >
                        {CAMPAIGN_STATUS_LABELS[campaign.status]}
                      </span>
                    </p>
                    <p className="text-xs text-[#667085]">
                      {campaign.channel}
                      {campaign.objective ? ` · ${campaign.objective}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[#98A2B3]">
                    {campaign.startDate ? campaign.startDate.toLocaleDateString("pt-BR") : "Sem início"}
                    {campaign.endDate ? ` – ${campaign.endDate.toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#EEF0F3] p-3">
                    <p className="text-lg font-semibold text-[#101828]">{formatCents(totals.spendCents)}</p>
                    <p className="text-xs text-[#667085]">investido</p>
                  </div>
                  <div className="rounded-lg border border-[#EEF0F3] p-3">
                    <p className="text-lg font-semibold text-[#101828]">{totals.impressions.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-[#667085]">impressões</p>
                  </div>
                  <div className="rounded-lg border border-[#EEF0F3] p-3">
                    <p className="text-lg font-semibold text-[#101828]">{totals.clicks.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-[#667085]">cliques</p>
                  </div>
                  <div className="rounded-lg border border-[#EEF0F3] p-3">
                    <p className="text-lg font-semibold text-[#101828]">{totals.results.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-[#667085]">resultados</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
