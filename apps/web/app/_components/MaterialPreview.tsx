import { getMaterialEmbed } from "@/lib/material-embed";

export function MaterialPreview({ url, className }: { url: string; className?: string }) {
  const embed = getMaterialEmbed(url);

  if (embed.kind === "link") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center rounded-lg border border-dashed border-[#D0D5DD] px-4 py-6 text-sm font-medium text-[#FF2B00] hover:bg-[#F6F7FB] ${className ?? ""}`}
      >
        Ver material (abre em outra aba)
      </a>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      {embed.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={embed.embedUrl}
          alt="Material para aprovação"
          className="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] object-contain"
        />
      )}
      {embed.kind === "video" && (
        <video
          src={embed.embedUrl}
          controls
          className="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg border border-[#E4E7EC] bg-black"
        />
      )}
      {embed.kind === "iframe" && (
        <div className="overflow-hidden rounded-lg border border-[#E4E7EC]">
          {/* Altura generosa e fixa (não presa a uma proporção) — o próprio
              visualizador do Drive/Figma ajusta a mídia dentro desse espaço,
              então funciona bem tanto pra imagem quadrada quanto formato
              Stories (vertical) sem espremer o conteúdo. */}
          <iframe
            src={embed.embedUrl}
            className="h-[75vh] min-h-[420px] w-full"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="self-end text-xs font-medium text-[#98A2B3] hover:text-[#FF2B00] hover:underline"
      >
        Abrir em outra aba ↗
      </a>
    </div>
  );
}
