import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_BADGE_CLASS, formatProposalValue, type TimelineStep } from "@/lib/proposals";
import { prisma } from "@zenite-mkt/db";
import { ProposalActions } from "./ProposalActions";
import { EditProposalForm } from "./EditProposalForm";
import { CopyProposalLinkButton } from "./CopyProposalLinkButton";
import { DeleteRecordButton } from "@/app/_components/DeleteRecordButton";
import { canManageTeam } from "@/lib/rbac";

interface PageProps {
  params: { id: string };
  searchParams: { send?: string };
}

/** Rótulo de cada campo que pode aparecer no diff gravado em `AuditLog` (rota PATCH). */
const CHANGED_FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  content: "Escopo do projeto",
  valueCents: "Investimento",
  paymentTerms: "Forma de pagamento",
  timelineSteps: "Prazos e etapas",
};

function formatChangedValue(field: string, value: unknown): string {
  if (value === "alterado") return "alterado";
  if (field === "valueCents") return formatProposalValue((value as number | null) ?? null);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default async function ProposalDetailPage({ params, searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { name: true, email: true, phone: true, whatsapp: true } },
      lead: { select: { name: true, email: true, phone: true } },
      opportunity: { select: { name: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!proposal || proposal.agencyId !== membership.agencyId) {
    notFound();
  }

  const editable = proposal.status !== "ACEITA";
  const timelineSteps = (proposal.timelineSteps as TimelineStep[] | null) ?? [];

  const changeLogs = await prisma.auditLog.findMany({
    where: { resourceType: "proposal", resourceId: proposal.id, action: "proposal.updated" },
    orderBy: { createdAt: "desc" },
  });
  const actorIds = [...new Set(changeLogs.map((log) => log.actorUserId).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorNameById = new Map(actors.map((actor) => [actor.id, actor.name]));
  const defaultEmail = proposal.recipientEmail ?? proposal.client?.email ?? proposal.lead?.email ?? null;
  const defaultWhatsapp = proposal.recipientWhatsapp ?? proposal.client?.whatsapp ?? proposal.client?.phone ?? proposal.lead?.phone ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/comercial/propostas" className="w-fit text-sm font-medium text-[#667085] hover:text-[#FF2B00]">
        ← Voltar para Propostas
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
            {proposal.name}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROPOSAL_STATUS_BADGE_CLASS[proposal.status]}`}>
              {PROPOSAL_STATUS_LABELS[proposal.status]}
            </span>
          </h1>
          <p className="text-sm text-[#667085]">
            {proposal.client?.name ?? proposal.lead?.name ?? proposal.opportunity?.name ?? "Sem vínculo"} ·{" "}
            {formatProposalValue(proposal.valueCents)}
          </p>
          {proposal.status !== "RASCUNHO" && (
            <div className="mt-2 flex items-center gap-2">
              <CopyProposalLinkButton token={proposal.token} />
              <a
                href={`/proposta/${proposal.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center justify-center rounded-md border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB]"
              >
                Ver como cliente ↗
              </a>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <ProposalActions
          proposalId={proposal.id}
          status={proposal.status}
          autoOpenSend={searchParams.send === "1"}
          defaultEmail={defaultEmail}
          defaultWhatsapp={defaultWhatsapp}
          />
          {canManageTeam(membership.role) && <DeleteRecordButton endpoint={`/api/proposals/${proposal.id}`} recordName={proposal.name} entityLabel="Proposta" warning="A negociação continuará registrada e o valor será recalculado pelas propostas restantes." redirectTo="/comercial/propostas" variant="button" />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Conteúdo</h2>
          {editable ? (
            <EditProposalForm
              proposalId={proposal.id}
              initial={{
                name: proposal.name,
                content: proposal.content,
                valueCents: proposal.valueCents,
                paymentTerms: proposal.paymentTerms,
                timelineSteps,
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-3 text-sm text-[#344054]">{proposal.content}</div>
              {proposal.paymentTerms && (
                <p className="text-sm text-[#344054]">
                  <span className="font-medium">Forma de pagamento:</span> {proposal.paymentTerms}
                </p>
              )}
              {timelineSteps.length > 0 && (
                <ul className="text-sm text-[#344054]">
                  {timelineSteps.map((step, i) => (
                    <li key={i}>
                      {step.label} — {step.days} dia{step.days === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {proposal.status === "REJEITADA" && proposal.rejectedReason && (
            <p className="mt-3 text-sm text-[#B42318]">Motivo da recusa: {proposal.rejectedReason}</p>
          )}
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Histórico</h2>
          <div className="flex flex-col gap-3">
            {proposal.statusHistory.map((entry) => (
              <div key={entry.id} className="border-l-2 border-[#EEF0F3] pl-3">
                <p className="text-sm text-[#101828]">
                  {entry.fromStatus
                    ? `${PROPOSAL_STATUS_LABELS[entry.fromStatus]} → ${PROPOSAL_STATUS_LABELS[entry.toStatus]}`
                    : `Criada como ${PROPOSAL_STATUS_LABELS[entry.toStatus]}`}
                  {entry.reason ? ` — ${entry.reason}` : ""}
                </p>
                <p className="text-xs text-[#98A2B3]">{entry.createdAt.toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </section>

        {changeLogs.length > 0 && (
          <section className="rounded-xl border border-[#E4E7EC] bg-white p-4 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-[#101828]">Alterações</h2>
            <div className="flex flex-col gap-3">
              {changeLogs.map((log) => {
                const metadata = log.metadata as { fields?: string[]; from?: Record<string, unknown>; to?: Record<string, unknown> } | null;
                const fields = metadata?.fields ?? [];
                return (
                  <div key={log.id} className="border-l-2 border-[#EEF0F3] pl-3">
                    <p className="text-sm text-[#101828]">
                      <span className="font-medium">{log.actorUserId ? (actorNameById.get(log.actorUserId) ?? "Alguém da equipe") : "Alguém da equipe"}</span>{" "}
                      alterou{" "}
                      {fields
                        .map((field) => {
                          const label = CHANGED_FIELD_LABELS[field] ?? field;
                          const from = formatChangedValue(field, metadata?.from?.[field]);
                          const to = formatChangedValue(field, metadata?.to?.[field]);
                          return `${label} (${from} → ${to})`;
                        })
                        .join(", ")}
                    </p>
                    <p className="text-xs text-[#98A2B3]">{log.createdAt.toLocaleString("pt-BR")}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
