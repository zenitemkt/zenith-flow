import { prisma } from "@zenite-mkt/db";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { MaterialPreview } from "@/app/_components/MaterialPreview";
import { ApprovalActions } from "./ApprovalActions";

interface PageProps {
  params: { token: string };
}

export default async function AprovarPage({ params }: PageProps) {
  const approval = await prisma.contentApproval.findUnique({
    where: { token: params.token },
    include: { contentVersion: { include: { contentItem: { include: { client: true } } } } },
  });

  const expired =
    !approval || approval.status !== "PENDENTE" || approval.expiresAt < new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        {expired || !approval ? (
          <>
            <h1 className="mb-1 text-lg font-semibold text-[#101828]">Link inválido</h1>
            <p className="text-sm text-[#667085]">
              Este link de aprovação não existe mais, já foi respondido ou expirou. Peça um novo
              link à agência.
            </p>
          </>
        ) : (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
              {approval.contentVersion.contentItem.client.name} ·{" "}
              {CONTENT_CHANNEL_LABELS[approval.contentVersion.contentItem.channel]}
            </p>
            <h1 className="mb-3 text-lg font-semibold text-[#101828]">
              {approval.contentVersion.contentItem.title}
            </h1>

            {approval.contentVersion.assetUrl && (
              <div className="mb-3 flex flex-col gap-1.5">
                <MaterialPreview url={approval.contentVersion.assetUrl} />
                <a
                  href={approval.contentVersion.assetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-end text-xs font-medium text-[#98A2B3] hover:text-[#FF2B00] hover:underline"
                >
                  Abrir em outra aba ↗
                </a>
              </div>
            )}

            {approval.contentVersion.contentItem.caption && (
              <p className="mb-4 rounded-lg bg-[#F9FAFB] p-3 text-sm text-[#475467]">
                {approval.contentVersion.contentItem.caption}
              </p>
            )}

            <ApprovalActions token={params.token} />
          </>
        )}
      </div>
    </div>
  );
}
