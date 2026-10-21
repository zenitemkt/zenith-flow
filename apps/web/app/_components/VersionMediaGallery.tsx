import { Layers } from "lucide-react";

export interface GalleryMedia {
  id: string;
  contentType: string;
  fileName: string;
}

/**
 * Arte de uma versão (imagem, vídeo ou carrossel). `srcBase` muda conforme
 * quem vê: equipe/portal (`/api/content-media`) ou link público de aprovação
 * (`/api/approvals/:token/media`).
 */
export function VersionMediaGallery({ media, srcBase, large = false }: { media: GalleryMedia[]; srcBase: string; large?: boolean }) {
  if (media.length === 0) return null;
  const single = media.length === 1;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={
          single
            ? ""
            : `flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]`
        }
      >
        {media.map((m) => {
          const src = `${srcBase}/${m.id}`;
          return (
            <div
              key={m.id}
              className={`overflow-hidden rounded-lg border border-[#EEF0F3] bg-[#F2F4F7] ${
                single ? (large ? "max-w-md" : "max-w-xs") : `shrink-0 snap-start ${large ? "w-64" : "w-40"}`
              }`}
            >
              {m.contentType.startsWith("video/") ? (
                <video src={src} controls preload="metadata" playsInline className="block aspect-[4/5] w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={m.fileName} loading="lazy" className="block aspect-[4/5] w-full object-cover" />
              )}
            </div>
          );
        })}
      </div>
      {!single && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-[#667085]">
          <Layers size={12} aria-hidden /> Carrossel · {media.length} itens (arraste para o lado)
        </p>
      )}
    </div>
  );
}
