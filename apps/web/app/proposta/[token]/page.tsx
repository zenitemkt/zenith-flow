import { Fragment } from "react";
import { prisma } from "@zenite-mkt/db";
import { PROPOSAL_STATUS_LABELS, formatProposalValue, isProposalExpired, type TimelineStep } from "@/lib/proposals";
import { ProposalDecisionActions } from "./ProposalDecisionActions";
import { PrintProposalButton } from "./PrintProposalButton";

interface PageProps {
  params: { token: string };
}

export default async function PropostaPage({ params }: PageProps) {
  let proposal = await prisma.proposal.findUnique({ where: { token: params.token } });

  const invalid = !proposal || proposal.status === "RASCUNHO";
  // isProposalExpired() só cobre a expiração calculada por data (status ainda
  // ENVIADA/VISUALIZADA); "Marcar como expirada" (ação manual do staff) já
  // grava EXPIRADA de verdade, então precisa ser checado à parte aqui —
  // senão a proposta expirada manualmente mostraria o formulário de novo.
  const expired = proposal ? isProposalExpired(proposal) || proposal.status === "EXPIRADA" : false;

  // Marca como visualizada na primeira vez que o link é aberto de verdade —
  // condicional na transição exata (ENVIADA -> VISUALIZADA) pra ser seguro
  // mesmo se o React re-renderizar o componente de servidor mais de uma vez.
  if (proposal && !invalid && !expired && proposal.status === "ENVIADA") {
    const now = new Date();
    await prisma.$transaction([
      prisma.proposal.update({ where: { id: proposal.id }, data: { status: "VISUALIZADA", viewedAt: now } }),
      prisma.proposalStatusHistory.create({
        data: { proposalId: proposal.id, fromStatus: "ENVIADA", toStatus: "VISUALIZADA" },
      }),
    ]);
    proposal = { ...proposal, status: "VISUALIZADA", viewedAt: now };
  }

  const decided = proposal?.status === "ACEITA" || proposal?.status === "REJEITADA";

  const [agency, creator] = proposal
    ? await Promise.all([
        prisma.agency.findUnique({ where: { id: proposal.agencyId }, select: { name: true } }),
        proposal.createdByUserId
          ? prisma.user.findUnique({ where: { id: proposal.createdByUserId }, select: { name: true } })
          : Promise.resolve(null),
      ])
    : [null, null];

  const timelineSteps = (proposal?.timelineSteps as TimelineStep[] | null) ?? [];

  return (
    <div className="min-h-screen bg-[#F6F7FB] px-4 py-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E4E7EC] bg-white shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-[#E4E7EC] px-8 py-6">
          <div className="flex items-center gap-2">
            <img src="/logo-z.png" alt="" aria-hidden className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold tracking-wide text-[#101828]">ZENITE MKT</span>
          </div>
          {!invalid && <PrintProposalButton />}
        </div>

        <div className="px-8 py-6">
          {invalid ? (
            <>
              <h1 className="mb-1 text-lg font-semibold text-[#101828]">Link inválido</h1>
              <p className="text-sm text-[#667085]">Esta proposta não existe ou ainda não foi enviada.</p>
            </>
          ) : expired ? (
            <>
              <h1 className="mb-1 text-lg font-semibold text-[#101828]">Proposta expirada</h1>
              <p className="text-sm text-[#667085]">Este link não está mais disponível. Peça uma nova proposta à agência.</p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                {PROPOSAL_STATUS_LABELS[proposal!.status]}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#101828]">Proposta Comercial</h1>
              <p className="text-sm text-[#667085]">{proposal!.name}</p>

              <section className="mt-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Escopo do Projeto</h2>
                <div className="mt-2 whitespace-pre-wrap text-sm text-[#344054]">{proposal!.content}</div>
              </section>

              <div className="mt-6 grid grid-cols-2 gap-6 border-t border-[#EEF0F3] pt-6">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Investimento</h2>
                  <p className="mt-1 text-xl font-semibold text-[#166534]">
                    {proposal!.valueCents !== null ? formatProposalValue(proposal!.valueCents) : "A combinar"}
                  </p>
                </div>
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Forma de Pagamento</h2>
                  <p className="mt-1 text-sm text-[#344054]">{proposal!.paymentTerms ?? "A combinar"}</p>
                </div>
              </div>

              {timelineSteps.length > 0 && (
                <section className="mt-6 border-t border-[#EEF0F3] pt-6">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Prazos e Etapas</h2>
                  <div className="flex items-start">
                    {timelineSteps.map((step, i) => (
                      <Fragment key={i}>
                        <div className="flex flex-col items-center text-center" style={{ minWidth: 72 }}>
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              i === 0 ? "text-white" : "border border-[#D0D5DD] text-[#98A2B3]"
                            }`}
                            style={i === 0 ? { backgroundColor: "#FF2B00" } : undefined}
                          >
                            {i === 0 ? "✓" : i + 1}
                          </div>
                          <p className="mt-2 text-xs font-medium text-[#101828]">{step.label}</p>
                          <p className="text-[11px] text-[#98A2B3]">{step.days} dias</p>
                        </div>
                        {i < timelineSteps.length - 1 && <div className="mt-3.5 h-px flex-1 bg-[#E4E7EC]" />}
                      </Fragment>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-8 border-t border-[#EEF0F3] pt-6 print:hidden">
                {decided ? (
                  <div
                    className={`rounded-lg p-4 text-center text-sm font-medium ${
                      proposal!.status === "ACEITA" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
                    }`}
                  >
                    {proposal!.status === "ACEITA" ? "Você já aceitou esta proposta." : "Você já recusou esta proposta."}
                  </div>
                ) : (
                  <ProposalDecisionActions token={params.token} />
                )}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[#EEF0F3] pt-4 text-xs text-[#98A2B3]">
                <span>{agency?.name}</span>
                <span>
                  {creator?.name ? `${creator.name} · ` : ""}
                  {proposal!.sentAt?.toLocaleDateString("pt-BR") ?? ""}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
