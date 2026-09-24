import { requirePortalContext } from "@/lib/portal";
import { prisma } from "@zenite-mkt/db";
import { PORTAL_REQUEST_STATUS_LABELS, PORTAL_REQUEST_STATUS_BADGE_CLASS, GRAPHIC_REQUEST_TAG } from "@/lib/portal-requests";
import { NewGraphicRequestModal } from "./NewGraphicRequestModal";

/** Tira o marcador `[Gráfica]` do título pra exibição — o cliente nunca precisa ver essa marcação interna. */
function displayTitle(title: string): string {
  return title.startsWith(GRAPHIC_REQUEST_TAG) ? title.slice(GRAPHIC_REQUEST_TAG.length).trim() : title;
}

export default async function PortalGraphicRequestsPage() {
  const { client } = await requirePortalContext();

  const tasks = await prisma.task.findMany({
    where: { project: { clientId: client.id }, title: { startsWith: GRAPHIC_REQUEST_TAG } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Peças gráficas</h1>
          <p className="text-sm text-[#9CA0AD]">
            Solicite uma cotação de impressão — cartão de visitas, panfletos, placas, banners, lonas, adesivos e outros.
          </p>
        </div>
        <NewGraphicRequestModal />
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center">
          <p className="text-sm text-[#667085]">Nenhuma cotação solicitada ainda. Peça a primeira.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#101828]">{displayTitle(task.title)}</p>
                  {task.description && (
                    <p className="mt-1 max-w-lg whitespace-pre-wrap text-sm text-[#475467]">{task.description}</p>
                  )}
                  <p className="mt-2 text-xs text-[#98A2B3]">
                    Enviada em {task.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${PORTAL_REQUEST_STATUS_BADGE_CLASS[task.status]}`}
                >
                  {PORTAL_REQUEST_STATUS_LABELS[task.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
