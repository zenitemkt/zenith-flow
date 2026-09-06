import { randomUUID } from "node:crypto";

/**
 * Chave pública (não-secreta) do coletor — mesmo modelo de GA4/Segment/Meta
 * Pixel: fica embutida no snippet do site, a segurança real é o consent gate
 * e a validação de schema, não o sigilo da chave. Server-only (usa
 * `node:crypto`) pelo mesmo motivo de `lib/media-server.ts`/`lib/nps-server.ts`
 * — importar isso de um client component quebra o build.
 */
export function generateTrackingWriteKey(): string {
  return `tk_${randomUUID().replace(/-/g, "")}`;
}
