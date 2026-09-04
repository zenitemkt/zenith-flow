import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { REQUEST_STATUS_LABELS, REQUEST_PRIORITY_LABELS } from "@/lib/requests";
import { prisma } from "@zenith/db";
import { NewRequestModal } from "./NewRequestModal";

const STATUS_BADGE_CLASS: Record<string, string> = {
  NOVA: "bg-[#EEF2FF] text-[#3730A3]",
  TRIAGEM: "bg-[#FEF3C7] text-[#92600A]",
  AGUARDANDO_INFORMACAO: "bg-[#FEF3C7] text-[#92600A]",
  APROVADA: "bg-[#DCFCE7] text-[#166534]",
  REJEITADA: "bg-[#FEE4E2] text-[#B42318]",
  CONVERTIDA: "bg-[#EEF2FF] text-[#3730A3]",
  CONCLUIDA: "bg-[#F2F4F7] text-[#475467]",
};

const PRIORITY_BADGE_CLASS: Record<string, string> = {
  BAIXA: "text-[#667085]",
  MEDIA: "text-[#B54708]",
  ALTA: "text-[#B42318]",
  URGENTE: "text-[#B42318] font-semibold",
};

export default async function DemandasPage() {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const [requests, clients] = await Promise.all([
    prisma.request.findMany({
      where: { agencyId: membership.agencyId },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Demandas</h1>
          <p className="text-sm text-[#667085]">
            {requests.length} demanda{requests.length === 1 ? "" : "s"} em {membership.agency.name}.
          </p>
        </div>
        <NewRequestModal clients={clients} />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">
            Nenhuma demanda ainda. Registre o primeiro pedido para começar a triagem.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="px-4 py-3">Demanda</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Prioridade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-t border-[#EEF0F3] hover:bg-[#F9FAFB]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/operacao/demandas/${req.id}`}
                      className="font-medium text-[#101828] hover:text-[#6847F5]"
                    >
                      {req.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#475467]">
                    {req.client?.name ?? <span className="text-[#98A2B3]">Interna</span>}
                  </td>
                  <td className={`px-4 py-3 ${req.priority ? PRIORITY_BADGE_CLASS[req.priority] : "text-[#98A2B3]"}`}>
                    {req.priority ? REQUEST_PRIORITY_LABELS[req.priority] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[req.status]}`}
                    >
                      {REQUEST_STATUS_LABELS[req.status]}
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
