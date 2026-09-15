export type MaterialEmbedKind = "image" | "video" | "iframe" | "link";

export interface MaterialEmbed {
  kind: MaterialEmbedKind;
  embedUrl: string;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv", "ogg"];

/**
 * Detecta como exibir o link do material direto na página, em vez de só
 * mandar abrir em outra aba (pedido do usuário, 2026-09-15 — ele sobe o
 * material no Google Drive e cola o link público). Reconhece Drive, Figma
 * e arquivo de imagem/vídeo direto; qualquer outra coisa cai no link normal
 * ("abrir em outra aba") porque não dá pra garantir que o site aceita ser
 * embutido em iframe (X-Frame-Options).
 */
export function getMaterialEmbed(rawUrl: string): MaterialEmbed {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: "link", embedUrl: rawUrl };
  }

  if (url.hostname === "drive.google.com" || url.hostname === "docs.google.com") {
    const fileIdFromPath = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
    const fileIdFromQuery = url.searchParams.get("id");
    const fileId = fileIdFromPath ?? fileIdFromQuery;
    if (fileId) {
      return { kind: "iframe", embedUrl: `https://drive.google.com/file/d/${fileId}/preview` };
    }
  }

  if (url.hostname === "www.figma.com" || url.hostname === "figma.com") {
    return {
      kind: "iframe",
      embedUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(rawUrl)}`,
    };
  }

  const ext = url.pathname.split(".").pop()?.toLowerCase();
  if (ext && IMAGE_EXTENSIONS.includes(ext)) {
    return { kind: "image", embedUrl: rawUrl };
  }
  if (ext && VIDEO_EXTENSIONS.includes(ext)) {
    return { kind: "video", embedUrl: rawUrl };
  }

  return { kind: "link", embedUrl: rawUrl };
}
