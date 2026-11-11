"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface Props {
  scope: "primeiro" | "sessao";
  active: Record<string, string>;
  options: { key: string; label: string; values: { value: string; count: number }[] }[];
}

/** Filtros de segmento (origem, UTM, página, local, aparelho). Preserva período e filtro de robôs na URL. */
export function TrackingSegmentFilter({ scope, active, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCount = Object.keys(active).length;
  const [open, setOpen] = useState(false);
  const labelOf = (key: string) => options.find((o) => o.key === key)?.label.replace(/ \(.*\)$/, "") ?? key;

  function update(changes: Record<string, string | null>) {
    const query = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    router.push(`${pathname}?${query.toString()}`);
  }

  function clearAll() {
    const changes: Record<string, null> = { escopo: null };
    for (const o of options) changes[o.key] = null;
    update(changes);
  }

  const unit = scope === "primeiro" ? "visitantes" : "sessões";

  // Recolhido por padrão: só o botão e, se houver, os filtros ativos como etiquetas removíveis.
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${activeCount ? "border-[#FF2B00] bg-[#FFF4ED] text-[#101828]" : "border-[#D0D5DD] bg-white text-[#475467]"}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" /></svg>
          Filtrar por segmento{activeCount ? ` (${activeCount})` : ""}
        </button>
        {Object.entries(active).map(([key, value]) => (
          <span key={key} className="flex h-8 items-center gap-1.5 rounded-full border border-[#FFD6C2] bg-[#FFF4ED] px-3 text-xs text-[#101828]">
            {labelOf(key)}: <strong className="font-semibold">{value}</strong>
            <button type="button" onClick={() => update({ [key]: null })} aria-label={`Remover filtro ${labelOf(key)}`} className="ml-0.5 text-[#B42318]">×</button>
          </span>
        ))}
        {activeCount > 0 && (
          <span className="text-xs text-[#667085]">{scope === "primeiro" ? "por primeiro toque" : "por qualquer sessão"}</span>
        )}
      </div>
    );
  }

  return (
    <section className="w-full basis-full rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#101828]">Filtrar por segmento</h2>
          <p className="text-xs text-[#667085]">
            {scope === "primeiro"
              ? "Primeiro toque: filtra pela primeira visita do visitante e mostra todas as sessões dele no período."
              : "Qualquer sessão: filtra cada sessão pelos dados dela."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#D0D5DD] p-0.5 text-xs font-medium">
            {(["primeiro", "sessao"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ escopo: value === "primeiro" ? null : value })}
                className={`rounded-md px-3 py-1.5 ${scope === value ? "bg-[#101828] text-white" : "text-[#475467]"}`}
              >
                {value === "primeiro" ? "Primeiro toque" : "Qualquer sessão"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#475467] hover:bg-[#F9FAFB]">
            Recolher
          </button>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#B42318] hover:bg-[#FEF3F2]">
              Limpar filtros ({activeCount})
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((o) => (
          <label key={o.key} className="flex flex-col gap-1 text-xs text-[#475467]">
            {o.label}
            <select
              value={active[o.key] ?? ""}
              onChange={(e) => update({ [o.key]: e.target.value || null })}
              className={`h-9 rounded-lg border px-2 text-sm ${active[o.key] ? "border-[#FF2B00] bg-[#FFF4ED] text-[#101828]" : "border-[#D0D5DD] bg-white text-[#344054]"}`}
            >
              <option value="">Todos</option>
              {active[o.key] && !o.values.some((v) => v.value === active[o.key]) && <option value={active[o.key]}>{active[o.key]} (0)</option>}
              {o.values.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value} ({v.count} {unit})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
