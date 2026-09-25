import { Download, ExternalLink, FileText, FolderOpen, ImageIcon, Film } from "lucide-react";
import { requirePortalContext } from "@/lib/portal";
import { formatBytes } from "@/lib/media";
import { prisma } from "@zenite-mkt/db";
import { EmptyState, PageHeader, panelClass } from "../_components/ui";

function iconFor(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType.startsWith("video/")) return Film;
  return FileText;
}

export default async function PortalArquivosPage() {
  const { client } = await requirePortalContext();

  const assets = await prisma.mediaAsset.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Arquivos" description="Tudo o que a equipe compartilhou com você, pronto pra baixar." />

      {client.driveUrl && (
        <a
          href={client.driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${panelClass} group flex items-center gap-4 px-5 py-4 transition-colors hover:border-[#FF7A1A]/40 sm:px-6`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#0E0F15] text-[#FF7A1A]">
            <FolderOpen size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-[#F5F2EE]">Pasta completa no Google Drive</span>
            <span className="text-xs text-[#8B8D9A]">Artes, contratos e outros materiais que não cabem aqui.</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-[#8B8D9A] transition-colors group-hover:text-[#FF8A5C]">
            Abrir
            <ExternalLink size={15} aria-hidden />
          </span>
        </a>
      )}

      {assets.length === 0 ? (
        <EmptyState title="Nenhum arquivo por aqui ainda">
          Quando a equipe compartilhar artes, contratos ou relatórios, eles aparecem nesta página.
        </EmptyState>
      ) : (
        <ul className={`${panelClass} divide-y divide-white/[0.05] overflow-hidden`}>
          {assets.map((asset) => {
            const Icon = iconFor(asset.contentType);
            return (
              <li key={asset.id}>
                <a
                  href={`/api/media/${asset.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:px-6"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#0E0F15] text-[#A3A5B2]">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#F5F2EE]">{asset.fileName}</span>
                    <span className="text-xs text-[#6B6D7C]">
                      {formatBytes(asset.sizeBytes)}, enviado em {asset.createdAt.toLocaleDateString("pt-BR")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-[#8B8D9A] transition-colors group-hover:text-[#FF8A5C]">
                    <Download size={15} aria-hidden />
                    <span className="hidden sm:inline">Baixar</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
