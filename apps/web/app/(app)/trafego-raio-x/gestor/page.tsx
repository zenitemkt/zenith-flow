import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@zenite-mkt/db";
import { requireSessionAndMembership } from "@/lib/session";
import { driveServiceAccountEmail } from "@/lib/google-drive";
import { creativeWarnings } from "@/lib/ad-creatives";
import { parseRules } from "@/lib/traffic-recommendations";
import { DEFAULT_CITIES, emptyPlan, parsePlan, planDailyTotal } from "@/lib/traffic-campaigns";
import { CreativeLibrary } from "./CreativeLibrary";
import { CampaignWizard } from "./CampaignWizard";
import { WizardModal } from "./WizardModal";
import { NewCampaignLanding } from "./NewCampaignLanding";
import { TrafficSettingsForm } from "./TrafficSettingsForm";
import { CampaignsList } from "./CampaignsList";
import { getHiddenClientIds, visibleByClientWhere, visibleByOptionalClientWhere } from "@/lib/client-access";

const TABS = [
  { id: "criativos", label: "Criativos" },
  { id: "nova", label: "Nova campanha" },
  { id: "campanhas", label: "Campanhas" },
  { id: "configuracoes", label: "Configurações" },
] as const;

export default async function TrafficManagerPage({ searchParams }: { searchParams: { aba?: string; campanha?: string; novo?: string; enviada?: string } }) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) redirect("/login");
  const hidden = await getHiddenClientIds(membership.agencyId, session.user.id);
  const agencyId = membership.agencyId;
  const tab = TABS.some((t) => t.id === searchParams.aba) ? searchParams.aba! : "criativos";

  const [folders, creatives, metaConnection, settings, pages, campaigns, metaCampaigns] = await Promise.all([
    prisma.adCreativeFolder.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" } }),
    prisma.adCreative.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.adAccountConnection.findUnique({ where: { agencyId_platform: { agencyId, platform: "META" } }, select: { externalAccountName: true, externalAccountId: true, scopes: true, status: true } }),
    prisma.trafficSettings.findUnique({ where: { agencyId } }),
    prisma.socialConnection.findMany({ where: { AND: [visibleByClientWhere(hidden)], agencyId, platform: "FACEBOOK", status: "ACTIVE" }, select: { id: true, name: true, leadsEnabled: true, client: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.trafficCampaign.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.campaign.findMany({
      where: { AND: [visibleByOptionalClientWhere(hidden)], agencyId, channel: "Meta Ads", externalId: { not: null }, status: { not: "ENCERRADA" } },
      orderBy: { createdAt: "desc" },
      select: { externalId: true, name: true, status: true, budgetCents: true, adSets: { where: { externalId: { not: null }, NOT: { metaStatus: { in: ["ARCHIVED", "DELETED"] } } }, orderBy: { name: "asc" }, select: { externalId: true, name: true, _count: { select: { ads: true } } } } },
    }),
  ]);

  const creativeRows = creatives.map((c) => ({
    id: c.id,
    driveFileId: c.driveFileId,
    name: c.name,
    fileName: c.fileName,
    kind: c.kind,
    width: c.width,
    height: c.height,
    sizeBytes: c.sizeBytes === null ? null : Number(c.sizeBytes),
    status: c.status,
    missingInDrive: c.missingInDrive,
    primaryText: c.primaryText,
    headline: c.headline,
    description: c.description,
    linkUrl: c.linkUrl,
    callToAction: c.callToAction,
    lastError: c.lastError,
    warnings: creativeWarnings(c),
  }));

  const editing = searchParams.campanha ? campaigns.find((c) => c.id === searchParams.campanha && (c.status === "DRAFT" || c.status === "FAILED" || c.status === "SUBMITTING")) : undefined;
  const cents = (v: number | null | undefined) => (v ? String(v / 100) : "");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Gestor de tráfego</h1>
        <p className="text-sm text-[#667085]">Criativos do Google Drive, campanhas com formulário instantâneo e as travas de verba. A campanha sobe pausada (conjuntos e anúncios ativos); quem ativa é você.</p>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl border border-[#E4E7EC] bg-white p-1">
        {TABS.map((t) => (
          <Link key={t.id} href={`/trafego-raio-x/gestor?aba=${t.id}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-[#101828] text-white" : "text-[#475467] hover:bg-[#F2F4F7]"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "criativos" && (
        <CreativeLibrary
          serviceEmail={driveServiceAccountEmail()}
          driveUserEmail={settings?.driveRefreshTokenEnc ? settings.driveAccountEmail ?? "conta conectada" : null}
          folders={folders.map((f) => ({ id: f.id, name: f.name, rootFolderId: f.rootFolderId, lastSyncAt: f.lastSyncAt?.toISOString() ?? null, lastSyncError: f.lastSyncError }))}
          metaAccount={metaConnection ? { name: metaConnection.externalAccountName ?? metaConnection.externalAccountId, canWrite: metaConnection.scopes.includes("ads_management"), active: metaConnection.status === "ACTIVE" } : null}
          creatives={creativeRows}
        />
      )}

      {tab === "nova" && (
        <NewCampaignLanding
          drafts={campaigns
            .filter((c) => c.status !== "SUBMITTED")
            .map((c) => {
              const plan = parsePlan(c.plan);
              return {
                id: c.id,
                title: plan.target ? (plan.mode === "ADD_ADS" ? `Novos anúncios · ${plan.target.adSetName}` : `Novos conjuntos · ${plan.target.campaignName}`) : c.name,
                status: c.status,
                updatedAt: c.updatedAt.toISOString(),
                adsets: plan.adsets.length,
                creatives: plan.adsets.reduce((n, a) => n + a.creativeIds.length, 0),
                lastError: c.lastError,
              };
            })}
        />
      )}
      {tab === "nova" && (editing || searchParams.novo) && (
        <WizardModal title={editing ? `Rascunho: ${parsePlan(editing.plan).target?.campaignName ?? editing.name}` : "Nova campanha"}>
        <CampaignWizard
          key={editing?.id ?? `new-${searchParams.novo ?? ""}`}
          campaignId={editing?.id ?? null}
          initialPlan={editing ? parsePlan(editing.plan) : { ...emptyPlan(), urlTags: settings?.urlTags ?? emptyPlan().urlTags }}
          savedUrlTags={settings?.urlTags ?? null}
          defaultCities={DEFAULT_CITIES}
          defaultButtonUrl={settings?.websiteUrl ?? "https://hubzenite.com.br/"}
          budgetCap={settings?.dailyBudgetCapCents ? settings.dailyBudgetCapCents / 100 : null}
          driveUserEmail={settings?.driveRefreshTokenEnc ? settings.driveAccountEmail ?? "conta conectada" : null}
          creatives={creativeRows.map((c) => ({ id: c.id, name: c.name, fileName: c.fileName, kind: c.kind, width: c.width, height: c.height, status: c.status, primaryText: c.primaryText, headline: c.headline, description: c.description, linkUrl: c.linkUrl, callToAction: c.callToAction }))}
        />
        </WizardModal>
      )}

      {tab === "campanhas" && searchParams.enviada && campaigns.some((c) => c.id === searchParams.enviada && c.status === "SUBMITTED") && (
        <div className="rounded-xl border border-[#ABEFC6] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">
          <p className="font-semibold">Campanha &quot;{campaigns.find((c) => c.id === searchParams.enviada)?.name}&quot; subiu para a Meta.</p>
          <p>A campanha está pausada e os conjuntos e anúncios, ativos. Confira no Gerenciador de Anúncios e ative a campanha quando quiser.</p>
        </div>
      )}
      {tab === "campanhas" && (
        <CampaignsList
          adAccountId={metaConnection?.externalAccountId ?? null}
          drafts={campaigns
            .filter((c) => c.status !== "SUBMITTED" || (!parsePlan(c.plan).target && !metaCampaigns.some((m) => m.externalId === c.metaCampaignId)))
            .map((c) => {
              const plan = parsePlan(c.plan);
              return {
                id: c.id,
                name: c.name,
                status: c.status,
                mode: plan.mode,
                targetLabel: plan.target ? (plan.mode === "ADD_ADS" ? `${plan.target.adSetName} · ${plan.target.campaignName}` : plan.target.campaignName) : null,
                metaCampaignId: c.metaCampaignId,
                lastError: c.lastError,
                createdAt: c.createdAt.toISOString(),
                submittedAt: c.submittedAt?.toISOString() ?? null,
                adsets: plan.adsets.length,
                ads: plan.adsets.reduce((n, a) => n + a.creativeIds.length, 0),
                dailyBudget: planDailyTotal(plan),
              };
            })}
          metaCampaigns={metaCampaigns.map((m) => ({
            metaCampaignId: m.externalId as string,
            name: m.name,
            status: m.status,
            budgetCents: m.budgetCents,
            fromPortal: campaigns.some((c) => c.metaCampaignId === m.externalId),
            adsets: m.adSets.map((a) => ({ metaAdSetId: a.externalId as string, name: a.name, ads: a._count.ads })),
          }))}
        />
      )}

      {tab === "configuracoes" && (
        <TrafficSettingsForm
          initial={{
            dailyBudgetCap: cents(settings?.dailyBudgetCapCents),
            cplGood: cents(settings?.cplGoodCents),
            cplMax: cents(settings?.cplMaxCents),
            maxBudgetChangePct: String(settings?.maxBudgetChangePct ?? 20),
            rules: (() => {
              const r = parseRules(settings?.recommendationRules);
              return { noLeadSpendMultiplier: String(r.noLeadSpendMultiplier), minLeadsToJudgeBad: String(r.minLeadsToJudgeBad), minLeadsToScale: String(r.minLeadsToScale), fatigueFrequency: String(r.fatigueFrequency), fatigueCtrDropPct: String(r.fatigueCtrDropPct) };
            })(),
            killSwitch: settings?.killSwitch ?? false,
            pageConnectionId: settings?.pageConnectionId ?? pages.find((p) => p.leadsEnabled)?.id ?? "",
            privacyPolicyUrl: settings?.privacyPolicyUrl ?? "https://hubzenite.com.br/politica-de-privacidade/",
            websiteUrl: settings?.websiteUrl ?? "https://hubzenite.com.br/",
          }}
          saved={Boolean(settings)}
          pages={pages.map((p) => ({ id: p.id, label: `${p.name} (${p.client.name})${p.leadsEnabled ? "" : " · sem formulários ligados"}` }))}
        />
      )}
    </div>
  );
}
