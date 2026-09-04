import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { prisma } from "@zenith/db";

function daysUntil(date: Date) {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function FilaDeAprovacaoPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [pendingApprovals, adjustmentItems] = await Promise.all([
    prisma.contentApproval.findMany({
      where: {
        status: "PENDENTE",
        contentVersion: { contentItem: { agencyId: membership.agencyId } },
      },
      include: {
        contentVersion: {
          include: { contentItem: { include: { client: { select: { id: true, name: true } } } } },
        },
      },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.contentItem.findMany({
      where: { agencyId: membership.agencyId, status: "AJUSTES" },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Fila de aprovação</h1>
          <p className="text-sm text-[#667085]">
            O que está esperando o cliente decidir, e o que voltou pedindo ajuste.
          </p>
        </div>
        <Link
          href="/conteudo/planejamento"
          className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
        >
          Ver planejamento
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">
          Aguardando decisão do cliente ({pendingApprovals.length})
        </h2>
        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center">
            <p className="text-sm text-[#667085]">Nada aguardando aprovação do cliente agora.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Versão</th>
                  <th className="px-4 py-3">Enviado em</th>
                  <th className="px-4 py-3">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map((approval) => {
                  const item = approval.contentVersion.contentItem;
                  const remaining = daysUntil(approval.expiresAt);
                  return (
                    <tr key={approval.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/conteudo/${item.id}`}
                          className="font-medium text-[#101828] hover:text-[#6847F5]"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{item.client.name}</td>
                      <td className="px-4 py-3 text-[#475467]">{CONTENT_CHANNEL_LABELS[item.channel]}</td>
                      <td className="px-4 py-3 text-[#475467]">v{approval.contentVersion.versionNumber}</td>
                      <td className="px-4 py-3 text-[#475467]">
                        {approval.createdAt.toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            remaining <= 1
                              ? "bg-[#FEE4E2] text-[#B42318]"
                              : remaining <= 3
                                ? "bg-[#FEF3C7] text-[#92600A]"
                                : "bg-[#F2F4F7] text-[#475467]"
                          }`}
                        >
                          {remaining <= 0 ? "Expira hoje" : `${remaining} dia${remaining === 1 ? "" : "s"}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[#101828]">
          Ajustes pedidos pelo cliente ({adjustmentItems.length})
        </h2>
        {adjustmentItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center">
            <p className="text-sm text-[#667085]">Nenhum ajuste pendente de resposta do time agora.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3">Peça</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Desde</th>
                </tr>
              </thead>
              <tbody>
                {adjustmentItems.map((item) => (
                  <tr key={item.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/conteudo/${item.id}`}
                        className="font-medium text-[#101828] hover:text-[#6847F5]"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#475467]">{item.client.name}</td>
                    <td className="px-4 py-3 text-[#475467]">{CONTENT_CHANNEL_LABELS[item.channel]}</td>
                    <td className="px-4 py-3 text-[#475467]">{item.updatedAt.toLocaleDateString("pt-BR")}</td>
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
