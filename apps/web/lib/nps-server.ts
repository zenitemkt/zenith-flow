import { randomUUID } from "node:crypto";

/** Server-only — nunca importar a partir de um client component (ver lib/media-server.ts para o mesmo padrão). */
export function generateSurveyToken(): string {
  return randomUUID();
}
