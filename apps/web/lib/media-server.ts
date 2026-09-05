import { randomUUID } from "node:crypto";

/** Server-only (usa node:crypto) — só importar de API routes, nunca de client components. */
export function buildObjectKey(agencyId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${agencyId}/${randomUUID()}-${safeName}`;
}
