import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS, LEAD_STATUS_TRANSITIONS, parseSiteLeadDetails } from "@/lib/leads";
import { getLeadJourney, applyAttributionModel, ATTRIBUTION_MODEL_LABELS } from "@/lib/attribution";
import { canManageTeam } from "@/lib/rbac";
import { OPPORTUNITY_STATUS_BADGE_CLASS, OPPORTUNITY_STATUS_LABELS } from "@/lib/pipeline";
import { prisma } from "@zenite-mkt/db";
import { LeadStatusActions } from "./LeadStatusActions";
import { ConvertLeadButton } from "./ConvertLeadButton";
import { AddLeadNoteForm } from "./AddLeadNoteForm";
import { DeleteLeadButton } from "./DeleteLeadButton";

interface PageProps {
  params: { id: string };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      statusHistory: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      convertedClient: { select: { id: true, name: true } },
      emails: { orderBy: { firstSeenAt: "asc" } },
      phones: { orderBy: { firstSeenAt: "asc" } },
      submissions: {
        orderBy: { createdAt: "desc" },
        include: { opportunity: { select: { id: true, status: true } } },
      },
    },
  });

  if (!lead || lead.agencyId !== membership.agencyId) {
    notFound();
  }

  let siteDetails: ReturnType<typeof parseSiteLeadDetails> = null;
  let siteDetailsNoteId: string | null = null;
  if (lead.source === "Site Zenite Hub") {
    for (const note of lead.notes) {
      const parsed = parseSiteLeadDetails(note.body);
      if (parsed) {
        siteDetails = parsed;
        siteDetailsNoteId = note.id;
        break;
      }
    }
  }
  const interestLabels: Record<string, string> = {
    servico: "Serviço específico",
    plano: "Plano completo de marketing",
    consultoria: "Consultoria de marketing",
  };

  type TimelineEntry = { id: string; kind: "status" | "note"; createdAt: Date; label: string };

  const timeline: TimelineEntry[] = [
    ...lead.statusHistory.map((entry) => ({
      id: entry.id,
      kind: "status" as const,
      createdAt: entry.createdAt,
      label: entry.fromStatus
        ? `Status mudou de ${LEAD_STATUS_LABELS[entry.fromStatus]} para ${LEAD_STATUS_LABELS[entry.toStatus]}${entry.reason ? ` — ${entry.reason}` : ""}`
        : `Lead criado como ${LEAD_STATUS_LABELS[entry.toStatus]}`,
    })),
    ...lead.notes.filter((note) => note.id !== siteDetailsNoteId).map((note) => ({ id: note.id, kind: "note" as const, createdAt: note.createdAt, label: note.body })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const touchpoints = await getLeadJourney(membership.agencyId, lead.id);
  const credited = applyAttributionModel(touchpoints, "last_non_direct");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/comercial/leads" className="w-fit text-sm font-medium text-[#667085] hover:text-[#FF2B00]">
        ← Voltar para Leads
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
            {lead.name}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEAD_STATUS_BADGE_CLASS[lead.status]}`}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
          </h1>
          <p className="text-sm text-[#667085]">
            {lead.company ?? "Sem empresa"} · {lead.source ?? "Origem não informada"}
          </p>
          <p className="mt-1 text-sm text-[#98A2B3]">
            {[lead.email, lead.phone].filter(Boolean).join(" · ") || "E-mail e telefone não cadastrados"}
          </p>
          {lead.convertedClient && (
            <p className="mt-1 text-sm text-[#98A2B3]">
              Convertido em{" "}
              <Link href={`/clientes/${lead.convertedClient.id}`} className="font-medium text-[#FF2B00] hover:underline">
                {lead.convertedClient.name}
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <LeadStatusActions leadId={lead.id} options={LEAD_STATUS_TRANSITIONS[lead.status]} />
          {lead.status === "QUALIFICADO" && <ConvertLeadButton leadId={lead.id} />}
          {canManageTeam(membership.role) && <DeleteLeadButton leadId={lead.id} leadName={lead.name} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Dados</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#667085]">Nome</dt>
              <dd className="text-right text-[#101828]">{lead.firstName ?? lead.name.split(" ")[0]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#667085]">Sobrenome</dt>
              <dd className="text-right text-[#101828]">{lead.lastName ?? "—"}</dd>
            </div>
            {(lead.emails.length > 0 ? lead.emails : lead.email ? [{ id: "primary-email", value: lead.email }] : []).map((email, index) => (
              <div key={email.id} className="flex justify-between gap-4">
                <dt className="text-[#667085]">E-mail {index + 1}</dt>
                <dd className="break-all text-right text-[#101828]">{email.value}</dd>
              </div>
            ))}
            {(lead.phones.length > 0 ? lead.phones : lead.phone ? [{ id: "primary-phone", value: lead.phone }] : []).map((phone, index) => (
              <div key={phone.id} className="flex justify-between gap-4">
                <dt className="text-[#667085]">Telefone {index + 1}</dt>
                <dd className="text-right text-[#101828]">{phone.value}</dd>
              </div>
            ))}
            {lead.emails.length === 0 && !lead.email && lead.phones.length === 0 && !lead.phone && (
              <div className="flex justify-between">
                <dt className="text-[#667085]">Contato</dt>
                <dd className="text-[#101828]">—</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[#667085]">Empresa</dt>
              <dd className="text-[#101828]">{lead.company ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#667085]">Origem</dt>
              <dd className="text-[#101828]">{lead.source ?? "—"}</dd>
            </div>
            {lead.disqualifiedReason && (
              <div className="flex justify-between">
                <dt className="text-[#667085]">Motivo da desqualificação</dt>
                <dd className="text-[#101828]">{lead.disqualifiedReason}</dd>
              </div>
            )}
          </dl>

          {siteDetails && (
            <div className="mt-5 border-t border-[#EEF0F3] pt-4">
              <h2 className="mb-3 text-sm font-semibold text-[#101828]">Informações do formulário</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(siteDetails).map(([label, rawValue]) => {
                  const value = label === "Interesse" ? interestLabels[rawValue] ?? rawValue : rawValue;
                  return (
                    <div key={label} className={label === "Resumo" ? "sm:col-span-2" : ""}>
                      <dt className="text-xs text-[#667085]">{label}</dt>
                      <dd className="mt-0.5 font-medium text-[#101828]">{value}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#101828]">Timeline</h2>
          <div className="mb-4">
            <AddLeadNoteForm leadId={lead.id} />
          </div>
          <div className="flex flex-col gap-3">
            {timeline.length === 0 && <p className="text-sm text-[#98A2B3]">Sem eventos ainda.</p>}
            {timeline.map((entry) => (
              <div key={entry.id} className="border-l-2 border-[#EEF0F3] pl-3">
                <p className="text-sm text-[#101828]">{entry.label}</p>
                <p className="text-xs text-[#98A2B3]">{entry.createdAt.toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {lead.submissions.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#101828]">Histórico de interesses</h2>
            <p className="mt-1 text-xs text-[#667085]">Cada preenchimento permanece salvo e gera uma oportunidade própria no funil.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {lead.submissions.map((submission, index) => {
              const fields = [
                ["Interesse", submission.interest ? interestLabels[submission.interest] ?? submission.interest : null],
                ["Serviço", submission.service],
                ["Empresa", submission.company],
                ["Cidade", submission.city],
                ["Funcionários", submission.employees],
                ["Investimento mensal", submission.investment],
              ].filter((entry): entry is [string, string] => Boolean(entry[1]));
              return (
                <article key={submission.id} className="rounded-xl border border-[#EEF0F3] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#101828]">Interesse #{lead.submissions.length - index}</p>
                      <p className="text-xs text-[#98A2B3]">{submission.createdAt.toLocaleString("pt-BR")} · {submission.source ?? "Origem não informada"}</p>
                    </div>
                    {submission.opportunity && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OPPORTUNITY_STATUS_BADGE_CLASS[submission.opportunity.status]}`}>
                        {OPPORTUNITY_STATUS_LABELS[submission.opportunity.status]}
                      </span>
                    )}
                  </div>
                  {fields.length > 0 && (
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {fields.map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-[#667085]">{label}</dt>
                          <dd className="mt-0.5 font-medium text-[#101828]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {submission.summary && <p className="mt-3 border-t border-[#EEF0F3] pt-3 text-sm text-[#475467]">{submission.summary}</p>}
                  {(submission.email || submission.phone) && (
                    <p className="mt-3 text-xs text-[#98A2B3]">{[submission.email, submission.phone].filter(Boolean).join(" · ")}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {touchpoints.length > 0 && (
        <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold text-[#101828]">Jornada de aquisição</h2>
          <p className="mb-3 text-xs text-[#98A2B3]">
            Sessões de tracking deste lead (seção 34/36 do manual), em ordem. Crédito de conversão pelo modelo{" "}
            {ATTRIBUTION_MODEL_LABELS.last_non_direct} — outros modelos disponíveis na página da campanha.
          </p>
          <div className="flex flex-col gap-1.5">
            {credited.map((tp) => (
              <div
                key={tp.sessionId}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  tp.weight > 0 ? "border-[#FF2B00] bg-[#FFF1EC]" : "border-[#EEF0F3]"
                }`}
              >
                <span className="text-[#101828]">{tp.channel}</span>
                <span className="flex items-center gap-2 text-xs text-[#98A2B3]">
                  {tp.occurredAt.toLocaleString("pt-BR")}
                  {tp.weight > 0 && (
                    <span className="rounded-full bg-[#FF2B00] px-2 py-0.5 text-[10px] font-semibold text-white">
                      crédito
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
