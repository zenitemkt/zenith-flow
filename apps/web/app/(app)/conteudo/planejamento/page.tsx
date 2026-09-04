import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { CONTENT_STATUS_LABELS, CONTENT_CHANNEL_LABELS, CONTENT_STATUS_BADGE_CLASS } from "@/lib/content";
import { prisma } from "@zenith/db";
import { NewContentModal } from "./NewContentModal";
import { ContentClientFilter } from "../ContentClientFilter";

interface PageProps {
  searchParams: { clientId?: string };
}

export default async function PlanejamentoPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const activeClientId = searchParams.clientId;

  const [items, clients] = await Promise.all([
    prisma.contentItem.findMany({
      where: {
        agencyId: membership.agencyId,
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeClient = clients.find((c) => c.id === activeClientId);
  const calendarHref = activeClientId
    ? `/conteudo/calendario?clientId=${activeClientId}`
    : "/conteudo/calendario";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Planejamento de conteúdo</h1>
          <p className="text-sm text-[#667085]">
            {items.length} peça{items.length === 1 ? "" : "s"}{" "}
            {activeClient ? `de ${activeClient.name}` : `em ${membership.agency.name}`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/conteudo/aprovacoes"
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Fila de aprovação
          </Link>
          <Link
            href={calendarHref}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Ver calendário
          </Link>
          <NewContentModal clients={clients} />
        </div>
      </div>

      <ContentClientFilter
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) =>
          clientId ? `/conteudo/planejamento?clientId=${clientId}` : "/conteudo/planejamento"
        }
      />

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            {activeClient ? `Nenhuma peça ainda para ${activeClient.name}.` : "Nenhuma peça ainda. Crie a primeira."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Peça</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
                  <td className="px-4 py-3 text-[#475467]">
                    {item.scheduledDate ? item.scheduledDate.toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTENT_STATUS_BADGE_CLASS[item.status]}`}
                    >
                      {CONTENT_STATUS_LABELS[item.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
