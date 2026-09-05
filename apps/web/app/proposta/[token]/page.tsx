import { prisma } from "@zenith/db";
import { PROPOSAL_STATUS_LABELS, formatProposalValue, isProposalExpired } from "@/lib/proposals";
import { ProposalDecisionActions } from "./ProposalDecisionActions";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
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
        ) : decided ? (
          <div
            className={`rounded-lg p-4 text-center text-sm font-medium ${
              proposal!.status === "ACEITA" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE4E2] text-[#B42318]"
            }`}
          >
            {proposal!.status === "ACEITA" ? "Você já aceitou esta proposta." : "Você já recusou esta proposta."}
          </div>
        ) : (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              {PROPOSAL_STATUS_LABELS[proposal!.status]}
            </p>
            <h1 className="mb-2 text-lg font-semibold text-[#101828]">{proposal!.name}</h1>
            {proposal!.valueCents !== null && (
              <p className="mb-3 text-2xl font-semibold text-[#166534]">{formatProposalValue(proposal!.valueCents)}</p>
            )}
            <div className="mb-4 whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-3 text-sm text-[#344054]">
              {proposal!.content}
            </div>
            <ProposalDecisionActions token={params.token} />
          </>
        )}
      </div>
    </div>
  );
}
