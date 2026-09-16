export interface SkeletonProps {
  className?: string;
}

/**
 * Bloco de carregamento genérico — cada `loading.tsx` de rota compõe a forma
 * aproximada da tela real com algumas instâncias deste primitivo, em vez de
 * um spinner genérico (seção de performance percebida da auditoria).
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-[#E4E7EC] dark:bg-[#232532] ${className}`} />;
}
