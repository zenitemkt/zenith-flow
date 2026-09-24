import { requirePortalContext } from "@/lib/portal";
import { prisma } from "@zenite-mkt/db";
import { GRAPHIC_REQUEST_TAG } from "@/lib/portal-requests";
import { NewPortalRequestModal } from "./NewPortalRequestModal";
import { EmptyState, PageHeader } from "../_components/ui";
import { RequestList } from "../_components/RequestList";

export default async function PortalRequestsPage() {
  const { client } = await requirePortalContext();

  // Cotações gráficas (aba própria, "/portal/grafica") não aparecem aqui —
  // mesma Task por baixo, mas o cliente já vê elas separadas lá.
  const tasks = await prisma.task.findMany({
    where: { project: { clientId: client.id }, NOT: { title: { startsWith: GRAPHIC_REQUEST_TAG } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Solicitações"
        description="Peça o que precisar à equipe e acompanhe o andamento por aqui."
        actions={<NewPortalRequestModal />}
      />

      {tasks.length === 0 ? (
        <EmptyState title="Nenhuma solicitação ainda">
          Precisa de um post novo, uma mudança ou um material? Abra uma solicitação e a equipe te responde.
        </EmptyState>
      ) : (
        <RequestList items={tasks} />
      )}
    </div>
  );
}
