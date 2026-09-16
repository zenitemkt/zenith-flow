import { Skeleton } from "@zenith/ui";

/**
 * Fallback genérico: por padrão do App Router, este `loading.tsx` cobre
 * TODA rota dentro de `(app)/` que ainda não tem seu próprio `loading.tsx`
 * mais específico (ex.: pipeline, operação, carteira, DRE) — troca a tela
 * anterior travada por um placeholder neutro em vez de nada.
 */
export default function AppSectionLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
