import { requirePortalContext } from "@/lib/portal";
import { MediaAssetList } from "@/app/_components/MediaAssetList";
import { prisma } from "@zenite-mkt/db";

export default async function PortalArquivosPage() {
  const { client } = await requirePortalContext();

  const assets = await prisma.mediaAsset.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Arquivos</h1>
        <p className="text-sm text-[#9CA0AD]">Arquivos que a agência compartilhou com você (seção 18 do manual).</p>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <MediaAssetList
          assets={assets.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
            createdAt: a.createdAt.toISOString(),
          }))}
          readOnly
        />
      </div>
    </div>
  );
}
