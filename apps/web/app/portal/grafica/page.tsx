import { requirePortalContext } from "@/lib/portal";
import { prisma } from "@zenite-mkt/db";
import { GRAPHIC_REQUEST_TAG } from "@/lib/portal-requests";
import { NewGraphicRequestModal } from "./NewGraphicRequestModal";
import { EmptyState, PageHeader } from "../_components/ui";
import { RequestList } from "../_components/RequestList";

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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Peças gráficas"
        description="Cartão de visitas, panfletos, placas, banners, lonas e adesivos. Conte o que precisa e a equipe faz o orçamento."
        actions={<NewGraphicRequestModal />}
      />

      {tasks.length === 0 ? (
        <EmptyState title="Nenhuma cotação pedida ainda">
          Peça a primeira: escolha o tipo de peça, a quantidade e os detalhes que já souber.
        </EmptyState>
      ) : (
        <RequestList items={tasks.map((task) => ({ ...task, title: displayTitle(task.title) }))} />
      )}
    </div>
  );
}
