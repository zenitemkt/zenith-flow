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
    <div className="relative min-h-screen overflow-hidden bg-[#0A0B10] px-4 py-16 print:overflow-visible print:bg-white print:p-0">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-220px] h-[640px] w-[640px] -translate-x-1/2 rounded-full opacity-60 blur-[130px] print:hidden"
        style={{ background: "radial-gradient(circle, #FF2B00 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[calc(50%+220px)] top-[160px] h-[420px] w-[420px] rounded-full opacity-40 blur-[110px] print:hidden"
        style={{ background: "radial-gradient(circle, #FF7A1A 0%, transparent 70%)" }}
      />

      <div className="absolute left-6 top-6 flex items-center gap-2 sm:left-10 sm:top-10 print:hidden">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: "#FF2B00" }}
        >
          Z
        </span>
        <span className="text-sm font-semibold tracking-wide text-white">ZENITE MKT</span>
      </div>

      <div className="relative mx-auto flex max-w-2xl flex-col items-center">
        <div className="w-full rounded-2xl border border-[#2F3140] bg-[#171821] shadow-[0_30px_80px_rgba(0,0,0,0.55)] print:w-full print:rounded-none print:border-0 print:bg-white print:shadow-none">
          <div className="flex items-center justify-between border-b border-[#2F3140] px-8 py-6 print:border-[#E4E7EC]">
            <div className="flex items-center gap-2">
              <img src="/logo-z.png" alt="" aria-hidden className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-sm font-semibold tracking-wide text-white print:text-[#101828]">ZENITE MKT</span>
            </div>
            {!invalid && <PrintProposalButton />}
          </div>

          <div className="px-8 py-6">
            {invalid ? (
              <>
                <h1 className="mb-1 text-lg font-semibold text-white print:text-[#101828]">Link inválido</h1>
                <p className="text-sm text-[#AEB4C5] print:text-[#667085]">Esta proposta não existe ou ainda não foi enviada.</p>
              </>
            ) : expired ? (
              <>
                <h1 className="mb-1 text-lg font-semibold text-white print:text-[#101828]">Proposta expirada</h1>
                <p className="text-sm text-[#AEB4C5] print:text-[#667085]">Este link não está mais disponível. Peça uma nova proposta à agência.</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8E93A6] print:text-[#98A2B3]">
                  {PROPOSAL_STATUS_LABELS[proposal!.status]}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white print:text-[#101828]">Proposta Comercial</h1>
                <p className="text-sm text-[#AEB4C5] print:text-[#667085]">{proposal!.name}</p>

                <section className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8E93A6] print:text-[#98A2B3]">Escopo do Projeto</h2>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-[#CFD3DF] print:text-[#344054]">{proposal!.content}</div>
                </section>

                <div className="mt-6 grid grid-cols-2 gap-6 border-t border-[#2F3140] pt-6 print:border-[#EEF0F3]">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8E93A6] print:text-[#98A2B3]">Investimento</h2>
                    <p className="mt-1 text-xl font-semibold text-[#4ADE80] print:text-[#166534]">
                      {proposal!.valueCents !== null ? formatProposalValue(proposal!.valueCents) : "A combinar"}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8E93A6] print:text-[#98A2B3]">Forma de Pagamento</h2>
                    <p className="mt-1 text-sm text-[#CFD3DF] print:text-[#344054]">{proposal!.paymentTerms ?? "A combinar"}</p>
                  </div>
                </div>

                {timelineSteps.length > 0 && (
                  <section className="mt-6 border-t border-[#2F3140] pt-6 print:border-[#EEF0F3]">
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#8E93A6] print:text-[#98A2B3]">Prazos e Etapas</h2>
                    <div className="flex items-start">
                      {timelineSteps.map((step, i) => (
                        <Fragment key={i}>
                          <div className="flex flex-col items-center text-center" style={{ minWidth: 72 }}>
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                i === 0 ? "text-white" : "border border-[#454965] text-[#8E93A6] print:border-[#D0D5DD] print:text-[#98A2B3]"
                              }`}
                              style={i === 0 ? { backgroundColor: "#FF2B00" } : undefined}
                            >
                              {i === 0 ? "✓" : i + 1}
                            </div>
                            <p className="mt-2 text-xs font-medium text-white print:text-[#101828]">{step.label}</p>
                            <p className="text-[11px] text-[#8E93A6] print:text-[#98A2B3]">{step.days} dias</p>
                          </div>
                          {i < timelineSteps.length - 1 && <div className="mt-3.5 h-px flex-1 bg-[#2F3140] print:bg-[#E4E7EC]" />}
                        </Fragment>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-8 border-t border-[#2F3140] pt-6 print:hidden">
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

                <div className="mt-8 flex items-center justify-between border-t border-[#2F3140] pt-4 text-xs text-[#8E93A6] print:border-[#EEF0F3] print:text-[#98A2B3]">
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
        <p className="mt-6 text-center text-xs text-[#6B6E7B] print:hidden">Zenite Hub Marketing</p>
      </div>
    </div>
  );
}
