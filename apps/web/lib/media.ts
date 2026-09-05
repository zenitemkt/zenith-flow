/**
 * Sem imports de Node aqui de propósito — este arquivo é importado tanto por
 * código de servidor quanto por client components (ex.: MediaAssetList
 * mostrando tamanho do arquivo). `buildObjectKey` (que usa node:crypto) mora
 * em lib/media-server.ts, só importado por API routes.
 */

/** Limite pragmático pra MVP — grande o bastante pra documentos/imagens comuns de agência. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
