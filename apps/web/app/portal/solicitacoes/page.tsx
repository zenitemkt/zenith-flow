import { requirePortalContext } from "@/lib/portal";
import { REQUEST_STATUS_LABELS } from "@/lib/requests";
import { prisma } from "@zenith/db";
import { NewPortalRequestModal } from "./NewPortalRequestModal";

const STATUS_BADGE_CLASS: Record<string, string> = {
  NOVA: "bg-[#F2F4F7] text-[#475467]",
  TRIAGEM: "bg-[#EEF2FF] text-[#3730A3]",
  AGUARDANDO_INFORMACAO: "bg-[#FEF3C7] text-[#92600A]",
  APROVADA: "bg-[#DCFCE7] text-[#166534]",
  REJEITADA: "bg-[#FEE4E2] text-[#B42318]",
  CONVERTIDA: "bg-[#DCFCE7] text-[#166534]",
  CONCLUIDA: "bg-[#DCFCE7] text-[#166534]",
};

export default async function PortalRequestsPage() {
  const { client } = await requirePortalContext();

  const requests = await prisma.request.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Solicitações</h1>
          <p className="text-sm text-[#667085]">
            {requests.length} solicitação{requests.length === 1 ? "" : "ões"} enviada
            {requests.length === 1 ? "" : "s"}.
          </p>
        </div>
        <NewPortalRequestModal />
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma solicitação ainda. Envie a primeira.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#101828]">{req.title}</p>
                  {req.description && (
                    <p className="mt-1 max-w-lg text-sm text-[#475467]">{req.description}</p>
                  )}
                  <p className="mt-2 text-xs text-[#98A2B3]">
                    Enviada em {req.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[req.status]}`}
                >
                  {REQUEST_STATUS_LABELS[req.status]}
                </span>
              </div>
              {req.status === "REJEITADA" && req.rejectionReason && (
                <p className="mt-3 rounded-lg bg-[#FEE4E2] px-3 py-2 text-xs text-[#B42318]">
                  <strong>Motivo:</strong> {req.rejectionReason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
