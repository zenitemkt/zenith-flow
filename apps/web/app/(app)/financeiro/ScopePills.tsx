import Link from "next/link";
import type { ScopeOption } from "@/lib/finance-scope";

/** Recorte das telas do Financeiro: Tudo · Zenite · (seu nome) · Não definido. Some se não há sócio cadastrado. */
export function ScopePills({ options, active, hrefFor }: { options: ScopeOption[]; active: string; hrefFor: (value: string) => string }) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-[#667085]">Ver</span>
      {options.map((option) => (
        <Link
          key={option.value || "all"}
          href={hrefFor(option.value)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            active === option.value ? "bg-[#101828] text-white" : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
