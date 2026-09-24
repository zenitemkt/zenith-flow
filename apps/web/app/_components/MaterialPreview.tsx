import { getMaterialEmbed } from "@/lib/material-embed";

export function MaterialPreview({
  url,
  className,
  tone = "light",
}: {
  url: string;
  className?: string;
  /** "dark" só no Portal do Cliente, que tem identidade visual escura própria. */
  tone?: "light" | "dark";
}) {
  const embed = getMaterialEmbed(url);
  const dark = tone === "dark";
  const frameBorder = dark ? "border-white/10" : "border-[#E4E7EC]";

  if (embed.kind === "link") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center rounded-lg border border-dashed px-4 py-6 text-sm font-medium ${
          dark
            ? "border-white/15 text-[#FF8A5C] hover:bg-white/[0.04]"
            : "border-[#D0D5DD] text-[#FF2B00] hover:bg-[#F6F7FB]"
        } ${className ?? ""}`}
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
          className={`mx-auto max-h-[80vh] w-auto max-w-full rounded-lg border object-contain ${frameBorder} ${
            dark ? "bg-black/30" : "bg-[#F9FAFB]"
          }`}
        />
      )}
      {embed.kind === "video" && (
        <video
          src={embed.embedUrl}
          controls
          className={`mx-auto max-h-[80vh] w-auto max-w-full rounded-lg border bg-black ${frameBorder}`}
        />
      )}
      {embed.kind === "iframe" && (
        <div className={`overflow-hidden rounded-lg border ${frameBorder}`}>
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
        className={`self-end text-xs font-medium hover:underline ${
          dark ? "text-[#8B8D9A] hover:text-[#FF8A5C]" : "text-[#98A2B3] hover:text-[#FF2B00]"
        }`}
      >
        Abrir em outra aba ↗
      </a>
    </div>
  );
}
