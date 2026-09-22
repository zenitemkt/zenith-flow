import Link from "next/link";
import { requirePortalContext } from "@/lib/portal";
import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { prisma } from "@zenite-mkt/db";

export default async function PortalHomePage() {
  const { client } = await requirePortalContext();

  const [pendingApprovals, upcoming, openRequests] = await Promise.all([
    prisma.contentApproval.findMany({
      where: { status: "PENDENTE", contentVersion: { contentItem: { clientId: client.id } } },
      include: { contentVersion: { include: { contentItem: true } } },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.contentItem.findMany({
      where: {
        clientId: client.id,
        scheduledDate: { gte: new Date() },
        status: { notIn: ["ARQUIVADO"] },
      },
      orderBy: { scheduledDate: "asc" },
      take: 5,
    }),
    prisma.task.count({
      where: { project: { clientId: client.id }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Olá, {client.name}</h1>
        <p className="text-sm text-[#667085]">
          Acompanhe o conteúdo planejado e aprove o que estiver esperando por você.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/portal/aprovacoes"
          className="rounded-xl border border-[#E4E7EC] bg-white p-5 hover:border-[#FF2B00]"
        >
          <p className="text-3xl font-semibold text-[#FF2B00]">{pendingApprovals.length}</p>
          <p className="text-sm text-[#475467]">
            peça{pendingApprovals.length === 1 ? "" : "s"} esperando sua aprovação
          </p>
        </Link>
        <Link
          href="/portal/calendario"
          className="rounded-xl border border-[#E4E7EC] bg-white p-5 hover:border-[#FF2B00]"
        >
          <p className="text-3xl font-semibold text-[#101828]">{upcoming.length}</p>
          <p className="text-sm text-[#475467]">peças agendadas nos próximos dias</p>
        </Link>
        <Link
          href="/portal/solicitacoes"
          className="rounded-xl border border-[#E4E7EC] bg-white p-5 hover:border-[#FF2B00]"
        >
          <p className="text-3xl font-semibold text-[#101828]">{openRequests}</p>
          <p className="text-sm text-[#475467]">solicitação{openRequests === 1 ? "" : "ões"} em andamento</p>
        </Link>
      </div>

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#101828]">Próximas peças</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-[#98A2B3]">Nada agendado por enquanto.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-[#101828]">{item.title}</p>
                  <p className="text-xs text-[#98A2B3]">{CONTENT_CHANNEL_LABELS[item.channel]}</p>
                </div>
                <p className="text-xs text-[#667085]">
                  {item.scheduledDate?.toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
