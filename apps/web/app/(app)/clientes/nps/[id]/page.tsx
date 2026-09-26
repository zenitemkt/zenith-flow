import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { canManageTeam } from "@/lib/rbac";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { SURVEY_STATUS_LABELS, SURVEY_STATUS_BADGE_CLASS } from "@/lib/nps";
import { isEmailConfigured } from "@/lib/email";
import { WhatsappLinkButton } from "@/app/_components/WhatsappLinkButton";
import { prisma } from "@zenite-mkt/db";
import { CampaignActions } from "./CampaignActions";
import { EditCampaignForm } from "./EditCampaignForm";
import { CopyLinkButton } from "./CopyLinkButton";

interface PageProps {
  params: { id: string };
}

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  ENVIADO: "Enviado",
  RESPONDIDO: "Respondido",
};

export default async function CampaignDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const campaign = await prisma.surveyCampaign.findUnique({
    where: { id: params.id },
    include: {
      recipients: {
        include: {
          client: { select: { name: true, contacts: { select: { email: true, phone: true, isPrimary: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      npsSnapshots: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });

  if (!campaign || campaign.agencyId !== membership.agencyId) {
    notFound();
  }

  const latestSnapshot = campaign.npsSnapshots[0];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/clientes/nps" className="mb-1 inline-flex w-fit items-center text-sm font-medium text-[#667085] hover:text-[#FF2B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B00] focus-visible:ring-offset-2">← Voltar para NPS</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[#101828]">{campaign.name}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${SURVEY_STATUS_BADGE_CLASS[campaign.status]}`}
            >
              {SURVEY_STATUS_LABELS[campaign.status]}
            </span>
          </div>
          <p className="text-sm text-[#667085]">{campaign.recipients.length} destinatário(s)</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CampaignActions campaignId={campaign.id} status={campaign.status} pendingCount={campaign.recipients.filter((r) => r.status === "PENDENTE").length} emailConfigured={isEmailConfigured()} />
          {canManageTeam(membership.role) && <DeleteRecordButton endpoint={`/api/nps/campaigns/${campaign.id}`} recordName={campaign.name} entityLabel="Pesquisa de NPS" warning="Destinatários, respostas e resultados históricos também serão removidos." redirectTo="/clientes/nps" variant="button" />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
      <Link href="/clientes/nps" className="mb-1 inline-flex w-fit items-center text-sm font-medium text-[#667085] hover:text-[#FF2B00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B00] focus-visible:ring-offset-2">← Voltar para NPS</Link>
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
              <h2 className="mb-3 text-sm font-semibold text-[#101828]">Resultado (NPS = % promotores − % detratores)</h2>
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
        </div>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Destinatários</h2>
          <div className="flex flex-col gap-2">
            {campaign.recipients.map((r) => {
              const phone =
                r.client.contacts.find((c) => c.email === r.email)?.phone ??
                r.client.contacts.find((c) => c.isPrimary)?.phone ??
                null;
              return (
                <div key={r.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#101828]">{r.client.name}</p>
                    <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-xs font-medium text-[#475467]">
                      {RECIPIENT_STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">
                    {r.contactName} · {r.email}
                  </p>
                  {r.status === "RESPONDIDO" ? (
                    <p className="mt-1 text-xs text-[#475467]">
                      Nota: <span className="font-semibold text-[#101828]">{r.score}</span>
                      {r.comment ? ` · "${r.comment}"` : ""}
                    </p>
                  ) : campaign.status !== "RASCUNHO" ? (
                    <div className="mt-2 flex gap-1.5">
                      <CopyLinkButton token={r.token} />
                      {phone && (
                        <WhatsappLinkButton
                          phone={phone}
                          intro="Oi! Segue nossa pesquisa rápida, sua opinião é muito importante pra gente:"
                          path={`/pesquisa/${r.token}`}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
