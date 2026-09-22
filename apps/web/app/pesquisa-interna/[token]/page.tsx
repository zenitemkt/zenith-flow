import { prisma } from "@zenite-mkt/db";
import { EnpsResponseForm } from "./EnpsResponseForm";

interface PageProps {
  params: { token: string };
}

export default async function PesquisaInternaPage({ params }: PageProps) {
  const invite = await prisma.enpsInvite.findUnique({
    where: { token: params.token },
    include: { campaign: true },
  });

  const invalid = !invite || invite.campaign.status === "RASCUNHO";
  const alreadyResponded = invite?.status === "RESPONDIDO";
  const closed = !alreadyResponded && invite?.campaign.status === "ENCERRADA";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        {invalid ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[#101828]">Link inválido</h1>
            <p className="text-sm text-[#667085]">
              Este link de pesquisa não existe ou ainda não foi enviado.
            </p>
          </>
        ) : closed ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[#101828]">Pesquisa encerrada</h1>
            <p className="text-sm text-[#667085]">Esta pesquisa não está mais recebendo respostas.</p>
          </>
        ) : alreadyResponded ? (
          <div className="rounded-lg bg-[#DCFCE7] p-4 text-center text-sm font-medium text-[#166534]">
            Você já respondeu esta pesquisa. Obrigado!
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              Pesquisa anônima — sua nota nunca é associada ao seu nome
            </p>
            {invite.campaign.headerText && (
              <p className="mb-3 text-sm text-[#475467]">{invite.campaign.headerText}</p>
            )}
            <h1 className="mb-4 text-lg font-semibold text-[#101828]">{invite.campaign.question}</h1>
            <EnpsResponseForm token={params.token} commentPrompt={invite.campaign.commentPrompt} />
            {invite.campaign.footerText && (
              <p className="mt-4 text-xs text-[#98A2B3]">{invite.campaign.footerText}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
