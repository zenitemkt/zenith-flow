import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canViewEnps } from "@/lib/rbac";
import { ENPS_STATUS_LABELS, ENPS_STATUS_BADGE_CLASS } from "@/lib/enps";
import { isEmailConfigured } from "@/lib/email";
import { WhatsappLinkButton } from "@/app/_components/WhatsappLinkButton";
import { prisma } from "@zenite-mkt/db";
import { CampaignActions } from "./CampaignActions";
import { EditCampaignForm } from "./EditCampaignForm";
import { CopyLinkButton } from "./CopyLinkButton";

interface PageProps {
  params: { id: string };
}

const INVITE_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  ENVIADO: "Enviado",
  RESPONDIDO: "Respondido",
};

export default async function EnpsCampaignDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }
  if (!canViewEnps(membership.role)) {
    redirect("/pessoas/equipe");
  }

  const campaign = await prisma.enpsCampaign.findUnique({
    where: { id: params.id },
    include: {
      invites: { include: { employee: { select: { name: true, phone: true } } }, orderBy: { createdAt: "asc" } },
      responses: { orderBy: { createdAt: "desc" } },
      snapshots: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  if (!campaign || campaign.agencyId !== membership.agencyId) {
    notFound();
  }

  const latestSnapshot = campaign.snapshots[0];
  const respondedCount = campaign.invites.filter((i) => i.status === "RESPONDIDO").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[#101828]">{campaign.name}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ENPS_STATUS_BADGE_CLASS[campaign.status]}`}>
              {ENPS_STATUS_LABELS[campaign.status]}
            </span>
          </div>
          <p className="text-sm text-[#667085]">
            {respondedCount} de {campaign.invites.length} responderam
          </p>
        </div>
        <CampaignActions
          campaignId={campaign.id}
          status={campaign.status}
          pendingCount={campaign.invites.filter((i) => i.status === "PENDENTE").length}
          emailConfigured={isEmailConfigured()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Personalização</h2>
            {campaign.status === "RASCUNHO" ? (
              <EditCampaignForm
                campaignId={campaign.id}
                initial={{
                  name: campaign.name,
                  question: campaign.question,
                  commentPrompt: campaign.commentPrompt ?? "",
                  headerText: campaign.headerText ?? "",
                  footerText: campaign.footerText ?? "",
                }}
              />
            ) : (
              <div className="flex flex-col gap-2 text-sm text-[#475467]">
                {campaign.headerText && <p className="text-[#98A2B3]">{campaign.headerText}</p>}
                <p className="font-medium text-[#101828]">{campaign.question}</p>
                {campaign.commentPrompt && <p>{campaign.commentPrompt}</p>}
                {campaign.footerText && <p className="text-[#98A2B3]">{campaign.footerText}</p>}
              </div>
            )}
          </section>

          {latestSnapshot && (
            <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-[#101828]">Resultado (eNPS = % promotores − % detratores)</h2>
              <p className="text-3xl font-semibold text-[#101828]">{latestSnapshot.score}</p>
              <p className="mt-1 text-xs text-[#98A2B3]">
                Calculado em {latestSnapshot.computedAt.toLocaleString("pt-BR")} · {latestSnapshot.totalResponses} resposta(s)
              </p>
              <div className="mt-3 flex gap-4 text-xs text-[#667085]">
                <span>Promotores: {latestSnapshot.promoters}</span>
                <span>Neutros: {latestSnapshot.passives}</span>
                <span>Detratores: {latestSnapshot.detractors}</span>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-1 text-sm font-semibold text-[#101828]">Respostas (anônimas)</h2>
            <p className="mb-3 text-xs text-[#98A2B3]">
              Notas e comentários abaixo nunca são ligados a quem respondeu — nem para quem administra a pesquisa.
            </p>
            <div className="flex flex-col gap-2">
              {campaign.responses.length === 0 && <p className="text-sm text-[#98A2B3]">Nenhuma resposta ainda.</p>}
              {campaign.responses.map((r) => (
                <div key={r.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                  <p className="text-sm font-semibold text-[#101828]">Nota: {r.score}</p>
                  {r.comment && <p className="text-xs text-[#667085]">&quot;{r.comment}&quot;</p>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-[#101828]">Convidados</h2>
          <p className="mb-3 text-xs text-[#98A2B3]">Mostra só participação (se respondeu), nunca a nota de cada pessoa.</p>
          <div className="flex flex-col gap-2">
            {campaign.invites.map((invite) => (
              <div key={invite.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#101828]">{invite.employee.name}</p>
                  <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#475467]">
                    {INVITE_STATUS_LABELS[invite.status]}
                  </span>
                </div>
                {invite.status !== "RESPONDIDO" && campaign.status !== "RASCUNHO" && (
                  <div className="mt-2 flex gap-1.5">
                    <CopyLinkButton token={invite.token} />
                    {invite.employee.phone && (
                      <WhatsappLinkButton
                        phone={invite.employee.phone}
                        intro="Oi! Segue nossa pesquisa interna anônima, sua opinião é importante:"
                        path={`/pesquisa-interna/${invite.token}`}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
