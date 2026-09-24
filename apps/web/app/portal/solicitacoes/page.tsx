import { requirePortalContext } from "@/lib/portal";
import { prisma } from "@zenite-mkt/db";
import { PORTAL_REQUEST_STATUS_LABELS, PORTAL_REQUEST_STATUS_BADGE_CLASS, GRAPHIC_REQUEST_TAG } from "@/lib/portal-requests";
import { NewPortalRequestModal } from "./NewPortalRequestModal";

const STATUS_LABELS = PORTAL_REQUEST_STATUS_LABELS;
const STATUS_BADGE_CLASS = PORTAL_REQUEST_STATUS_BADGE_CLASS;

export default async function PortalRequestsPage() {
  const { client } = await requirePortalContext();

  // Cotações gráficas (aba própria, "/portal/grafica") não aparecem aqui —
  // mesma Task por baixo, mas o cliente já vê elas separadas lá.
  const tasks = await prisma.task.findMany({
    where: { project: { clientId: client.id }, NOT: { title: { startsWith: GRAPHIC_REQUEST_TAG } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Solicitações</h1>
          <p className="text-sm text-[#9CA0AD]">
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
