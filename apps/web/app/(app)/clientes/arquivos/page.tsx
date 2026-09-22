import { redirect } from "next/navigation";
import { requireSessionAndMembership } from "@/lib/session";
import { prisma } from "@zenite-mkt/db";
import { ClientFilterPills } from "@/app/_components/ClientFilterPills";
import { UploadFileForm } from "@/app/_components/UploadFileForm";
import { MediaAssetList } from "@/app/_components/MediaAssetList";

interface PageProps {
  searchParams: { clientId?: string };
}

export default async function ArquivosPage({ searchParams }: PageProps) {
  const { session, membership } = await requireSessionAndMembership();
  if (!session || !membership) {
    redirect("/login");
  }

  const activeClientId = searchParams.clientId;

  const [assets, clients] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: {
        agencyId: membership.agencyId,
        ...(activeClientId ? { clientId: activeClientId } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { agencyId: membership.agencyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeClient = clients.find((c) => c.id === activeClientId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-[#101828]">Arquivos</h1>
        <p className="text-sm text-[#667085]">
          {assets.length} arquivo{assets.length === 1 ? "" : "s"}
          {activeClient ? ` de ${activeClient.name}` : ""} em {membership.agency.name}.
        </p>
      </div>

      <ClientFilterPills
        clients={clients}
        activeClientId={activeClientId}
        buildHref={(clientId) => (clientId ? `/clientes/arquivos?clientId=${clientId}` : "/clientes/arquivos")}
      />

      <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3">
          <MediaAssetList
            showClient
            assets={assets.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              contentType: a.contentType,
              sizeBytes: a.sizeBytes,
              createdAt: a.createdAt.toISOString(),
              clientName: a.client?.name,
            }))}
          />
        </div>
        <UploadFileForm clientOptions={clients} />
      </section>
    </div>
  );
}
