import type { CampaignStatus } from "@zenite-mkt/db";
import { requirePortalContext } from "@/lib/portal";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaigns";
import { formatCents } from "@/lib/finance";
import { prisma } from "@zenite-mkt/db";
import { EmptyState, PageHeader, panelClass } from "../_components/ui";

const STATUS_PILL: Record<CampaignStatus, string> = {
  ATIVA: "bg-[#16A36A]/[0.15] text-[#5EE0A6]",
  PAUSADA: "bg-[#F5B544]/[0.13] text-[#F7C66A]",
  ENCERRADA: "bg-white/[0.07] text-[#A3A5B2]",
};

/**
 * Somente leitura — o cliente nunca cria/edita campanha nem métrica, só
 * acompanha o que a agência já cadastrou (`/comercial/campanhas`, seção 36).
 * Sem o painel "Atribuição Zenite" (isso é sobre o funil comercial da
 * própria agência, seção 39 — não faz sentido pro cliente).
 */
export default async function PortalTrafegoPage() {
  const { client } = await requirePortalContext();

  const campaigns = await prisma.campaign.findMany({
    where: { clientId: client.id },
    include: { dailyMetrics: true },
    orderBy: { createdAt: "desc" },
  });

  const formatNumber = (value: number) => value.toLocaleString("pt-BR");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tráfego pago" description="As campanhas de anúncio que a equipe gerencia pra você, com o resultado acumulado." />

      {campaigns.length === 0 ? (
        <EmptyState title="Nenhuma campanha no ar">
          Quando a equipe começar uma campanha de anúncios pra você, os números aparecem aqui.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
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
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
            const costPerResult = totals.results > 0 ? Math.round(totals.spendCents / totals.results) : null;

            const period = campaign.startDate
              ? `${campaign.startDate.toLocaleDateString("pt-BR")}${
                  campaign.endDate ? ` até ${campaign.endDate.toLocaleDateString("pt-BR")}` : " em diante"
                }`
              : "Sem data de início";

            return (
              <section key={campaign.id} className={`${panelClass} p-6`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-[-0.015em]">{campaign.name}</h2>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[#8B8D9A]">
                      <span>{campaign.channel}</span>
                      {campaign.objective && <span>{campaign.objective}</span>}
                      <span>{period}</span>
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[campaign.status]}`}>
                    {CAMPAIGN_STATUS_LABELS[campaign.status]}
                  </span>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
                  {[
                    { label: "Investido", value: formatCents(totals.spendCents) },
                    { label: "Impressões", value: formatNumber(totals.impressions) },
                    { label: "Cliques", value: formatNumber(totals.clicks) },
                    { label: "Resultados", value: formatNumber(totals.results) },
                  ].map((metric) => (
                    <div key={metric.label} className="bg-[#101118] px-4 py-4">
                      <dt className="text-xs text-[#8B8D9A]">{metric.label}</dt>
                      <dd className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">{metric.value}</dd>
                    </div>
                  ))}
                </dl>

                {(ctr !== null || costPerResult !== null) && (
                  <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#A3A5B2]">
                    {ctr !== null && (
                      <span>
                        Taxa de clique <span className="font-medium text-[#F5F2EE]">{ctr.toFixed(2).replace(".", ",")}%</span>
                      </span>
                    )}
                    {costPerResult !== null && (
                      <span>
                        Custo por resultado <span className="font-medium text-[#F5F2EE]">{formatCents(costPerResult)}</span>
                      </span>
                    )}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
