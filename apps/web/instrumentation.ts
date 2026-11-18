/** Roda uma vez quando cada instância do servidor sobe (Next 14: requer experimental.instrumentationHook). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ setModelWriteListener }, { onModelWrite }] = await Promise.all([import("@zenite-mkt/db"), import("@/lib/cron-wake")]);
  // Escritas nas filas (posts, sequências do Instagram, Milena) acordam o cron correspondente.
  setModelWriteListener(onModelWrite);
}
