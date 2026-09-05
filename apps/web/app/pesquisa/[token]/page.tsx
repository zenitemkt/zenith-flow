import { prisma } from "@zenith/db";
import { SurveyResponseForm } from "./SurveyResponseForm";

interface PageProps {
  params: { token: string };
}

export default async function PesquisaPage({ params }: PageProps) {
  const recipient = await prisma.surveyRecipient.findUnique({
    where: { token: params.token },
    include: { campaign: true },
  });

  const invalid = !recipient || recipient.campaign.status === "RASCUNHO";
  const alreadyResponded = recipient?.status === "RESPONDIDO";
  /// Quem já respondeu vê a confirmação de resposta, não "encerrada" — a
  /// campanha ter fechado depois não invalida o "obrigado" de quem já
  /// participou (achado ao testar o fluxo completo, não por inspeção).
  const closed = !alreadyResponded && recipient?.campaign.status === "ENCERRADA";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        {invalid ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[#101828]">Link inválido</h1>
            <p className="text-sm text-[#667085]">
              Este link de pesquisa não existe ou ainda não foi enviado. Fale com a agência.
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
            {recipient.campaign.headerText && (
              <p className="mb-3 text-sm text-[#475467]">{recipient.campaign.headerText}</p>
            )}
            <h1 className="mb-4 text-lg font-semibold text-[#101828]">{recipient.campaign.question}</h1>
            <SurveyResponseForm token={params.token} commentPrompt={recipient.campaign.commentPrompt} />
            {recipient.campaign.footerText && (
              <p className="mt-4 text-xs text-[#98A2B3]">{recipient.campaign.footerText}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
