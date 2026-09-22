import { requirePortalContext } from "@/lib/portal";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { prisma } from "@zenite-mkt/db";
import { MaterialPreview } from "@/app/_components/MaterialPreview";
import { PortalApprovalActions } from "./PortalApprovalActions";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Aprovações</h1>
        <p className="text-sm text-[#667085]">O que está esperando sua decisão, e o que você já respondeu.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">
          Esperando sua decisão ({pendingApprovals.length})
        </h2>
        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center">
            <p className="text-sm text-[#667085]">Nada esperando sua aprovação agora.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingApprovals.map((approval) => {
              const item = approval.contentVersion.contentItem;
              return (
                <div key={approval.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[#101828]">{item.title}</p>
                    <p className="text-xs text-[#98A2B3]">
                      {CONTENT_CHANNEL_LABELS[item.channel]} · v{approval.contentVersion.versionNumber}
                    </p>
                    {item.caption && (
                      <p className="mt-2 max-w-md text-sm text-[#475467]">{item.caption}</p>
                    )}
                  </div>
                  {approval.contentVersion.assetUrl && (
                    <div className="mb-3">
                      <MaterialPreview url={approval.contentVersion.assetUrl} />
                    </div>
                  )}
                  <PortalApprovalActions contentItemId={item.id} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">Respondidas recentemente</h2>
        {decidedApprovals.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nenhuma decisão registrada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Versão</th>
                  <th className="px-4 py-3">Decisão</th>
                  <th className="px-4 py-3">Em</th>
                </tr>
              </thead>
              <tbody>
                {decidedApprovals.map((approval) => (
                  <tr key={approval.id} className="border-t border-[#EEF0F3]">
                    <td className="px-4 py-3 font-medium text-[#101828]">
                      {approval.contentVersion.contentItem.title}
                    </td>
                    <td className="px-4 py-3 text-[#475467]">v{approval.contentVersion.versionNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          approval.status === "APROVADO"
                            ? "rounded-full bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]"
                            : "rounded-full bg-[#FEE4E2] px-2 py-0.5 text-xs font-medium text-[#B42318]"
                        }
                      >
                        {approval.status === "APROVADO" ? "Aprovado" : "Ajuste pedido"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475467]">
                      {approval.decidedAt?.toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
