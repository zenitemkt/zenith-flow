import { requirePortalContext } from "@/lib/portal";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { prisma } from "@zenite-mkt/db";
import { MaterialPreview } from "@/app/_components/MaterialPreview";
import { PortalApprovalActions } from "./PortalApprovalActions";
import { EmptyState, PageHeader, panelClass } from "../_components/ui";

export default async function PortalApprovalsPage() {
  const { client } = await requirePortalContext();

  const pendingApprovals = await prisma.contentApproval.findMany({
    where: { status: "PENDENTE", contentVersion: { contentItem: { clientId: client.id } } },
    include: { contentVersion: { include: { contentItem: true } } },
    orderBy: { expiresAt: "asc" },
  });

  const decidedApprovals = await prisma.contentApproval.findMany({
    where: {
      status: { not: "PENDENTE" },
      contentVersion: { contentItem: { clientId: client.id } },
    },
    include: { contentVersion: { include: { contentItem: true } } },
    orderBy: { decidedAt: "desc" },
    take: 10,
  });

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Aprovações"
        description={
          pendingApprovals.length === 0
            ? "Nada esperando sua decisão agora."
            : `${pendingApprovals.length} ${pendingApprovals.length === 1 ? "peça espera" : "peças esperam"} a sua decisão. Aprove ou peça um ajuste em cada uma.`
        }
      />

      <section className="flex flex-col gap-4">
        {pendingApprovals.length === 0 ? (
          <EmptyState title="Tudo aprovado">
            Quando a equipe enviar uma peça nova pra você revisar, ela aparece aqui.
          </EmptyState>
        ) : (
          pendingApprovals.map((approval) => {
            const item = approval.contentVersion.contentItem;
            return (
              <article key={approval.id} className={`${panelClass} grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_320px]`}>
                <div className="min-w-0">
                  {approval.contentVersion.assetUrl ? (
                    <MaterialPreview url={approval.contentVersion.assetUrl} tone="dark" />
                  ) : (
                    <p className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-[#8B8D9A]">
                      Esta versão não tem material anexado.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-5">
                  <div>
                    <h2 className="font-display text-xl font-semibold leading-snug tracking-[-0.015em]">{item.title}</h2>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-[#8B8D9A]">
                      <span>{CONTENT_CHANNEL_LABELS[item.channel]}</span>
                      <span>versão {approval.contentVersion.versionNumber}</span>
                      <span>
                        responder até{" "}
                        {approval.expiresAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </p>
                  </div>
                  {item.caption && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-[#8B8D9A]">Legenda</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D6D3CF]">{item.caption}</p>
                    </div>
                  )}
                  <div className="mt-auto">
                    <PortalApprovalActions contentItemId={item.id} />
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {decidedApprovals.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Respondidas recentemente</h2>
          <ul className={`${panelClass} divide-y divide-white/[0.05] overflow-hidden`}>
            {decidedApprovals.map((approval) => {
              const approved = approval.status === "APROVADO";
              return (
                <li key={approval.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[#F5F2EE]">
                      {approval.contentVersion.contentItem.title}
                    </span>
                    <span className="text-xs text-[#8B8D9A]">
                      versão {approval.contentVersion.versionNumber}
                      {approval.decidedAt ? `, em ${approval.decidedAt.toLocaleDateString("pt-BR")}` : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      approved ? "bg-[#16A36A]/[0.15] text-[#5EE0A6]" : "bg-[#F5B544]/[0.13] text-[#F7C66A]"
                    }`}
                  >
                    {approved ? "Aprovado" : "Ajuste pedido"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
