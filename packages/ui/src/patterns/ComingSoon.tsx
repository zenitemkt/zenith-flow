import { Construction } from "lucide-react";

export interface ComingSoonProps {
  title: string;
  description?: string;
}

/**
 * Empty state padrão (seção 5 do manual) para telas ainda não implementadas.
 * Toda aba nasce apontando para esta tela até sua fatia funcional ser entregue.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#E4E7EC] bg-white px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1EC] text-[#FF2B00]">
        <Construction size={22} aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-[#101828]">{title}</h1>
      <p className="mt-1 max-w-sm text-sm text-[#667085]">
        {description ?? "Esta funcionalidade está em desenvolvimento e será habilitada em uma próxima entrega."}
      </p>
    </div>
  );
}
