import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE_CLASS, CAMPAIGN_STATUS_TRANSITIONS } from "@/lib/campaigns";
import { formatCents } from "@/lib/finance";
import { ATTRIBUTION_MODELS, ATTRIBUTION_MODEL_LABELS, computeCampaignAttribution, type AttributionModel } from "@/lib/attribution";
import { prisma } from "@zenite-mkt/db";
import { CampaignStatusActions } from "./CampaignStatusActions";
import { AddDailyMetricForm } from "./AddDailyMetricForm";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { canManageTeam } from "@/lib/rbac";

interface PageProps {
  params: { id: string };
  searchParams: { model?: string };
}

export default async function CampaignDetailPage({ params, searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: { dailyMetrics: { orderBy: { date: "desc" }, take: 30 }, client: { select: { id: true, name: true } } },
  });

  if (!campaign || campaign.agencyId !== membership.agencyId) {
    notFound();
  }

  const model: AttributionModel = ATTRIBUTION_MODELS.includes(searchParams.model as AttributionModel)
    ? (searchParams.model as AttributionModel)
    : "last_non_direct";

  const attributedLeads = await computeCampaignAttribution(membership.agencyId, campaign.id, model);

  const totals = campaign.dailyMetrics.reduce(
    (acc, m) => ({
      spendCents: acc.spendCents + m.spendCents,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      results: acc.results + (m.results ?? 0),
    }),
    { spendCents: 0, impressions: 0, clicks: 0, results: 0 },
  );
  const attributedRevenueCents = attributedLeads.reduce((sum, row) => sum + Math.round(row.wonValueCents * row.weight), 0);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/comercial/campanhas" className="w-fit text-sm font-medium text-[#667085] hover:text-[#FF2B00]">
        ← Voltar para Campanhas
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
            {campaign.name}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_BADGE_CLASS[campaign.status]}`}>
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </span>
          </h1>
          <p className="text-sm text-[#667085]">
            {campaign.channel} · {campaign.objective ?? "Sem objetivo informado"}
            {campaign.client && (
              <>
                {" · "}
                <Link href={`/clientes/${campaign.client.id}`} className="font-medium text-[#FF2B00] hover:underline">
                  {campaign.client.name}
                </Link>{" "}
                <span className="text-xs text-[#98A2B3]">(visível no portal em Tráfego pago)</span>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-[#98A2B3]">
            {campaign.startDate ? campaign.startDate.toLocaleDateString("pt-BR") : "Sem início"}
            {campaign.endDate ? ` – ${campaign.endDate.toLocaleDateString("pt-BR")}` : ""}
            {campaign.budgetCents !== null && ` · Orçamento: ${formatCents(campaign.budgetCents)}`}
          </p>
          {(campaign.utmSource || campaign.utmCampaign) && (
            <p className="mt-1 text-xs text-[#98A2B3]">
              Casamento com tracking: utm_source={campaign.utmSource ?? "—"} · utm_campaign={campaign.utmCampaign ?? "—"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <CampaignStatusActions campaignId={campaign.id} options={CAMPAIGN_STATUS_TRANSITIONS[campaign.status]} />
          {canManageTeam(membership.role) && <DeleteRecordButton endpoint={`/api/campaigns/${campaign.id}`} recordName={campaign.name} entityLabel="Campanha" warning="Métricas, conjuntos de anúncios, anúncios e segmentações vinculadas também serão removidos." redirectTo="/comercial/campanhas" variant="button" />}
        </div>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#101828]">Métricas reportadas</h2>
        </div>
        <p className="mb-3 text-xs text-[#98A2B3]">
          Digitadas à mão nesta fatia (sem conector com plataforma de anúncios ainda — seção 38).
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[#EEF0F3] p-3">
            <p className="text-lg font-semibold text-[#101828]">{formatCents(totals.spendCents)}</p>
            <p className="text-xs text-[#667085]">gasto (últimos 30 dias)</p>
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
        <div className="mb-3">
          <AddDailyMetricForm campaignId={campaign.id} />
        </div>
        {campaign.dailyMetrics.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhum dia registrado ainda.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {campaign.dailyMetrics.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-1.5 text-xs text-[#475467]">
                <span>{m.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                <span>{formatCents(m.spendCents)}</span>
                <span>{m.impressions.toLocaleString("pt-BR")} impr.</span>
                <span>{m.clicks.toLocaleString("pt-BR")} cliques</span>
                <span>{m.results ?? 0} resultados</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#101828]">Atribuição Zenite</h2>
          <div className="flex gap-1.5">
            {ATTRIBUTION_MODELS.map((m) => (
              <Link
                key={m}
                href={`/comercial/campanhas/${campaign.id}?model=${m}`}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  m === model ? "bg-[#FF2B00] text-white" : "border border-[#D0D5DD] text-[#344054]"
                }`}
              >
                {ATTRIBUTION_MODEL_LABELS[m]}
              </Link>
            ))}
          </div>
        </div>
        <p className="mb-3 text-xs text-[#98A2B3]">
          Calculada a partir do tracking e do CRM próprios do Zenite Mkt — pode divergir do que a plataforma de
          anúncios reporta acima (janela, identidade e modelagem diferentes). Nunca são a mesma coisa.
        </p>
        <div className="mb-3 rounded-lg border border-[#EEF0F3] p-3">
          <p className="text-lg font-semibold text-[#166534]">{formatCents(attributedRevenueCents)}</p>
          <p className="text-xs text-[#667085]">receita atribuída (oportunidades ganhas, ponderada pelo modelo)</p>
        </div>
        {attributedLeads.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhum lead atribuído a esta campanha ainda neste modelo.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {attributedLeads.map((row) => (
              <Link
                key={row.leadId}
                href={`/comercial/leads/${row.leadId}`}
                className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2 text-sm hover:border-[#FF2B00]"
              >
                <span className="font-medium text-[#101828]">{row.leadName}</span>
                <span className="flex items-center gap-3 text-xs text-[#667085]">
                  <span>{Math.round(row.weight * 100)}% do crédito</span>
                  {row.wonValueCents > 0 && <span className="text-[#166534]">{formatCents(row.wonValueCents)} ganho</span>}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
