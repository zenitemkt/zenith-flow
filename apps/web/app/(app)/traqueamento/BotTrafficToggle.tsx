"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
  active: boolean;
}

/** Liga/desliga o filtro de tráfego não humano nos resultados (seção 2.1) — ativo por padrão. Preserva os demais filtros (período etc.) já na URL. */
export function BotTrafficToggle({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const query = new URLSearchParams(searchParams.toString());
    if (active) {
      query.set("excludeBots", "0");
    } else {
      query.delete("excludeBots");
    }
    router.push(`${pathname}?${query.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
        active
          ? "border-[#17B26A] bg-[#ECFDF3] text-[#067647]"
          : "border-[#D0D5DD] bg-white text-[#475467]"
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-[#17B26A]" : "bg-[#98A2B3]"}`} />
      Filtrar tráfego não humano: {active ? "ativo" : "desativado"}
    </button>
  );
}
