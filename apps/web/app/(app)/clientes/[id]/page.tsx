import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CLIENT_STATUS_LABELS, CLIENT_STATUS_TRANSITIONS } from "@/lib/clients";
import { prisma } from "@zenite-mkt/db";
import { StatusActions } from "./StatusActions";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { AddContactForm } from "./AddContactForm";
import { ClientContactItem } from "./ClientContactItem";
import { AddNoteForm } from "./AddNoteForm";
import { EditClientButton } from "./EditClientButton";
import { ClientPortalSection } from "./ClientPortalSection";
import { UploadFileForm } from "@/app/_components/UploadFileForm";
import { MediaAssetList } from "@/app/_components/MediaAssetList";
import { RecalculateHealthScoreButton } from "./RecalculateHealthScoreButton";
import { HEALTH_BAND_LABELS, HEALTH_BAND_BADGE_CLASS, bandForScore, type HealthScoreBreakdown } from "@/lib/health-score";
import { RecalculateChurnRiskButton } from "./RecalculateChurnRiskButton";
import { CHURN_BAND_LABELS, CHURN_BAND_BADGE_CLASS, type ChurnRiskSignals } from "@/lib/churn-risk";
import { NewRetentionPlanModal } from "./NewRetentionPlanModal";
import { RetentionPlanActions } from "./RetentionPlanActions";
import { getAgencyMembers } from "@/lib/team";

interface PageProps {
  params: { id: string };
}

export default async function ClientProfilePage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      statusHistory: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      onboardingRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { items: { orderBy: { order: "asc" } } },
      },
      mediaAssets: { orderBy: { createdAt: "desc" } },
      _count: { select: { contentItems: true } },
    },
  });

  if (!client || client.agencyId !== membership.agencyId) {
    notFound();
  }

  const [latestHealthScore, latestChurnRisk, retentionPlans, teamMembersRaw, portalMembersRaw] = await Promise.all([
    prisma.healthScoreSnapshot.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
    prisma.churnRiskSnapshot.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
    prisma.retentionPlan.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" } }),
    getAgencyMembers(membership.agencyId),
    client.workspaceId
      ? prisma.membership.findMany({
          where: { workspaceId: client.workspaceId },
          select: { id: true, email: true, role: true, status: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve(null),
  ]);
  const healthBreakdown = latestHealthScore?.breakdown as unknown as HealthScoreBreakdown | undefined;
  const churnSignals = latestChurnRisk?.signals as unknown as ChurnRiskSignals | undefined;
  const teamMemberById = new Map(teamMembersRaw.map((m) => [m.userId, m.name]));

  const portalMembers = (portalMembersRaw ?? []).filter(
    (m): m is typeof m & { role: "CLIENT_ADMIN" | "CLIENT_VIEWER" } =>
      m.role === "CLIENT_ADMIN" || m.role === "CLIENT_VIEWER",
  );

  const latestRun = client.onboardingRuns[0];

  type TimelineEntry = {
    id: string;
    kind: "status" | "note";
    createdAt: Date;
    label: string;
  };

  const timeline: TimelineEntry[] = [
    ...client.statusHistory.map((entry) => ({
      id: entry.id,
      kind: "status" as const,
      createdAt: entry.createdAt,
      label: entry.fromStatus
        ? `Status mudou de ${CLIENT_STATUS_LABELS[entry.fromStatus]} para ${CLIENT_STATUS_LABELS[entry.toStatus]}${entry.reason ? ` — ${entry.reason}` : ""}`
        : `Cliente criado como ${CLIENT_STATUS_LABELS[entry.toStatus]}`,
    })),
    ...client.notes.map((note) => ({
      id: note.id,
      kind: "note" as const,
      createdAt: note.createdAt,
      label: note.body,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
            {client.name}
            {latestHealthScore && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_BAND_BADGE_CLASS[bandForScore(latestHealthScore.score)]}`}
              >
                Health {latestHealthScore.score} · {HEALTH_BAND_LABELS[bandForScore(latestHealthScore.score)]}
              </span>
            )}
            {latestChurnRisk && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHURN_BAND_BADGE_CLASS[latestChurnRisk.band]}`}
              >
                Risco de churn: {CHURN_BAND_LABELS[latestChurnRisk.band]}
              </span>
            )}
          </h1>
          <p className="text-sm text-[#667085]">
            {client.document ?? "Sem CNPJ cadastrado"} · {CLIENT_STATUS_LABELS[client.status]}
          </p>
          <p className="mt-1 text-sm text-[#98A2B3]">
            {[client.email, client.phone, client.whatsapp ? `WhatsApp ${client.whatsapp}` : null]
              .filter(Boolean)
              .join(" · ") || "E-mail, telefone e WhatsApp ainda não cadastrados"}
          </p>
          <p className="mt-1 text-sm text-[#98A2B3]">
            <Link
              href={`/operacao?clientId=${client.id}`}
              className="font-medium text-[#FF2B00] hover:underline"
            >
              Conteúdo: {client._count.contentItems} peça
              {client._count.contentItems === 1 ? "" : "s"}
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusActions clientId={client.id} options={CLIENT_STATUS_TRANSITIONS[client.status]} />
          <EditClientButton
            clientId={client.id}
            initialValues={{
              name: client.name,
              document: client.document ?? "",
              email: client.email ?? "",
              phone: client.phone ?? "",
              whatsapp: client.whatsapp ?? "",
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#101828]">Health Score</h2>
              <RecalculateHealthScoreButton clientId={client.id} />
            </div>
            {!latestHealthScore || !healthBreakdown ? (
              <p className="text-sm text-[#98A2B3]">Ainda não calculado. Clique em &quot;Recalcular&quot;.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#98A2B3]">
                  Calculado em {latestHealthScore.createdAt.toLocaleString("pt-BR")} ·{" "}
                  {latestHealthScore.modelVersion}
                </p>
                {(
                  [
                    ["Financeiro", healthBreakdown.financeiro],
                    ["Entregas", healthBreakdown.entregas],
                    ["Aprovações", healthBreakdown.aprovacoes],
                  ] as const
                ).map(([label, dim]) => (
                  <div key={label} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#101828]">{label}</p>
                      <p className="text-sm font-semibold text-[#101828]">
                        {dim.score} <span className="text-xs font-normal text-[#98A2B3]">({Math.round(dim.weight * 100)}%)</span>
                      </p>
                    </div>
                    {!dim.hasData ? (
                      <p className="text-xs text-[#98A2B3]">Sem dado suficiente ainda — usando neutro.</p>
                    ) : (
                      <p className="text-xs text-[#667085]">
                        {Object.entries(dim.signals)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-xs text-[#98A2B3]">
                  Dimensões ainda sem dado real no sistema (não entram no cálculo): {healthBreakdown.pendente.join(", ")}.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#101828]">Risco de churn</h2>
              <RecalculateChurnRiskButton clientId={client.id} />
            </div>
            {!latestChurnRisk || !churnSignals ? (
              <p className="text-sm text-[#98A2B3]">Ainda não calculado. Clique em &quot;Recalcular&quot;.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#98A2B3]">
                  Calculado em {latestChurnRisk.createdAt.toLocaleString("pt-BR")} · Score {latestChurnRisk.score} ·{" "}
                  {latestChurnRisk.modelVersion}
                </p>
                {(
                  [
                    ["Health baixo/queda recente (+25)", churnSignals.health],
                    ["Faturas atrasadas (+20)", churnSignals.faturasAtrasadas],
                    ["Entregas atrasadas (+15)", churnSignals.entregasAtrasadas],
                  ] as const
                ).map(([label, signal]) => (
                  <div key={label} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#101828]">{label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          signal.triggered ? "bg-[#FEE4E2] text-[#B42318]" : "bg-[#F2F4F7] text-[#475467]"
                        }`}
                      >
                        {signal.triggered ? "Disparado" : "Ok"}
                      </span>
                    </div>
                    {!signal.hasData ? (
                      <p className="text-xs text-[#98A2B3]">Sem dado suficiente ainda.</p>
                    ) : (
                      <p className="text-xs text-[#667085]">
                        {Object.entries(signal.details)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
                {churnSignals.recoveryPlanActive && (
                  <p className="text-xs font-medium text-[#3730A3]">
                    Plano de recuperação ativo — não somado ao score, só sinalizado como contexto.
                  </p>
                )}
                <p className="text-xs text-[#98A2B3]">
                  Sinais ainda sem dado real no sistema (não entram no cálculo): {churnSignals.pendente.join(", ")}.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#101828]">Planos de retenção</h2>
              <NewRetentionPlanModal clientId={client.id} teamMembers={teamMembersRaw} />
            </div>
            <div className="flex flex-col gap-2">
              {retentionPlans.length === 0 && <p className="text-sm text-[#98A2B3]">Nenhum plano ainda.</p>}
              {retentionPlans.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-[#EEF0F3] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#101828]">{plan.alertReason}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.status === "ATIVO"
                          ? "bg-[#EEF2FF] text-[#3730A3]"
                          : plan.status === "CONCLUIDO"
                            ? "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#F2F4F7] text-[#475467]"
                      }`}
                    >
                      {plan.status === "ATIVO" ? "Ativo" : plan.status === "CONCLUIDO" ? "Concluído" : "Cancelado"}
                    </span>
                  </div>
                  <p className="text-xs text-[#667085]">Diagnóstico: {plan.diagnosis}</p>
                  <p className="text-xs text-[#667085]">
                    Responsável: {teamMemberById.get(plan.responsibleUserId) ?? "—"} · Plano: {plan.planDescription}
                  </p>
                  {(plan.meetingDate || plan.reassessDate) && (
                    <p className="text-xs text-[#98A2B3]">
                      {plan.meetingDate ? `Reunião: ${plan.meetingDate.toLocaleDateString("pt-BR")}` : ""}
                      {plan.meetingDate && plan.reassessDate ? " · " : ""}
                      {plan.reassessDate ? `Reavaliação: ${plan.reassessDate.toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  )}
                  {plan.result && <p className="text-xs text-[#667085]">Resultado: {plan.result}</p>}
                  {plan.status === "ATIVO" && (
                    <div className="mt-2">
                      <RetentionPlanActions planId={plan.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Contatos</h2>
            <div className="flex flex-col gap-2">
              {client.contacts.length === 0 && (
                <p className="text-sm text-[#98A2B3]">Nenhum contato ainda.</p>
              )}
              {client.contacts.map((contact) => (
                <ClientContactItem key={contact.id} clientId={client.id} contact={contact} />
              ))}
              <AddContactForm clientId={client.id} />
            </div>
          </section>

          {latestRun && (
            <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-[#101828]">Checklist de onboarding</h2>
              <OnboardingChecklist
                items={latestRun.items.map((item) => ({
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  status: item.status,
                }))}
              />
            </section>
          )}

          <ClientPortalSection
            clientId={client.id}
            clientIsActive={Boolean(client.workspaceId)}
            members={portalMembers}
          />

          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Arquivos</h2>
            <div className="mb-3">
              <MediaAssetList
                assets={client.mediaAssets.map((a) => ({
                  id: a.id,
                  fileName: a.fileName,
                  contentType: a.contentType,
                  sizeBytes: a.sizeBytes,
                  createdAt: a.createdAt.toISOString(),
                }))}
              />
            </div>
            <UploadFileForm clientId={client.id} />
          </section>
        </div>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Timeline</h2>
          <div className="mb-4">
            <AddNoteForm clientId={client.id} />
          </div>
          <div className="flex flex-col gap-3">
            {timeline.length === 0 && <p className="text-sm text-[#98A2B3]">Sem eventos ainda.</p>}
            {timeline.map((entry) => (
              <div key={entry.id} className="border-l-2 border-[#EEF0F3] pl-3">
                <p className="text-sm text-[#101828]">{entry.label}</p>
                <p className="text-xs text-[#98A2B3]">
                  {entry.createdAt.toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
