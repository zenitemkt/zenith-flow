import { requirePortalContext } from "@/lib/portal";
import { prisma } from "@zenite-mkt/db";
import { NewPortalRequestModal } from "./NewPortalRequestModal";

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Recebida",
  PLANEJADA: "Recebida",
  EM_ANDAMENTO: "Em andamento",
  BLOQUEADA: "Em andamento",
  REVISAO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  BACKLOG: "bg-[#F2F4F7] text-[#475467]",
  PLANEJADA: "bg-[#F2F4F7] text-[#475467]",
  EM_ANDAMENTO: "bg-[#EEF2FF] text-[#3730A3]",
  BLOQUEADA: "bg-[#EEF2FF] text-[#3730A3]",
  REVISAO: "bg-[#EEF2FF] text-[#3730A3]",
  CONCLUIDA: "bg-[#DCFCE7] text-[#166534]",
  CANCELADA: "bg-[#FEE4E2] text-[#B42318]",
};

export default async function PortalRequestsPage() {
  const { client } = await requirePortalContext();

  const tasks = await prisma.task.findMany({
    where: { project: { clientId: client.id } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#101828]">Solicitações</h1>
          <p className="text-sm text-[#667085]">
            {tasks.length} solicitação{tasks.length === 1 ? "" : "ões"} enviada
            {tasks.length === 1 ? "" : "s"}.
          </p>
        </div>
        <NewPortalRequestModal />
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma solicitação ainda. Envie a primeira.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#101828]">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 max-w-lg text-sm text-[#475467]">{task.description}</p>
                  )}
                  <p className="mt-2 text-xs text-[#98A2B3]">
                    Enviada em {task.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASS[task.status]}`}
                >
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
