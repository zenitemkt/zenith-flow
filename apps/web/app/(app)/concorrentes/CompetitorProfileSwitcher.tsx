"use client";

import { useRouter } from "next/navigation";

interface Option {
  id: string;
  label: string;
  href: string;
}

/** Troca o perfil visto na aba (Instagram/Google/Site), agrupado por papel. O valor de cada opção já é a URL de destino. */
export function CompetitorProfileSwitcher({ currentHref, own, direct, reference }: { currentHref: string; own: Option[]; direct: Option[]; reference: Option[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Trocar perfil"
      value={currentHref}
      onChange={(event) => router.push(event.target.value)}
      className="h-9 max-w-[220px] rounded-lg border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054] outline-none focus:border-[#FF2B00]"
    >
      {own.length > 0 && (
        <optgroup label="Perfil do cliente">
          {own.map((o) => (
            <option key={o.id} value={o.href}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      {direct.length > 0 && (
        <optgroup label="Concorrentes diretos">
          {direct.map((o) => (
            <option key={o.id} value={o.href}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      {reference.length > 0 && (
        <optgroup label="Concorrentes de referência">
          {reference.map((o) => (
            <option key={o.id} value={o.href}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
