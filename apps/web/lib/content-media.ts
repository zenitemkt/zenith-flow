/**
 * Arte das versões de conteúdo (imagem/vídeo) — sem imports de Node, usado
 * também por client components. O lado servidor (assinar URL, gravar no R2)
 * mora em lib/content-media-server.ts.
 */

/** Acima disso o navegador sobe direto pro R2 (URL assinada) — o corpo de uma função na Vercel tem limite de ~4,5MB. */
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

/** Limites práticos do Instagram: imagem até 8MB, Reels até ~300MB. */
export const CONTENT_MEDIA_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const CONTENT_MEDIA_MAX_VIDEO_BYTES = 300 * 1024 * 1024;
/** Carrossel do Instagram aceita até 10 itens. */
export const CONTENT_MEDIA_MAX_FILES = 10;

export const CONTENT_MEDIA_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CONTENT_MEDIA_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export function isVideoType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

/** Mensagem de erro em português, ou null se o arquivo pode ser enviado. */
export function validateContentMediaFile(file: { type: string; size: number; name: string }): string | null {
  const isImage = CONTENT_MEDIA_IMAGE_TYPES.includes(file.type);
  const isVideo = CONTENT_MEDIA_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) return `"${file.name}": use JPG, PNG, WEBP, MP4 ou MOV.`;
  if (isImage && file.size > CONTENT_MEDIA_MAX_IMAGE_BYTES) return `"${file.name}": imagem passa de 8MB.`;
  if (isVideo && file.size > CONTENT_MEDIA_MAX_VIDEO_BYTES) return `"${file.name}": vídeo passa de 300MB.`;
  return null;
}
