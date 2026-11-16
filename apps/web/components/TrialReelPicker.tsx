"use client";

export type TrialStrategy = "" | "MANUAL" | "SS_PERFORMANCE";

/** Reel de teste da Meta: mostra primeiro só para não seguidores. */
export function TrialReelPicker({ value, onChange }: { value: TrialStrategy; onChange: (v: TrialStrategy) => void }) {
  const options: [TrialStrategy, string, string][] = [
    ["", "Normal", "Sai para todo mundo, como sempre."],
    ["MANUAL", "Teste: eu decido", "Vai só para não seguidores. Você compartilha com todos pelo app do Instagram se for bem."],
    ["SS_PERFORMANCE", "Teste: compartilhar sozinho", "Vai só para não seguidores. Se tiver muitas visualizações nas primeiras 72 horas, o Instagram compartilha com todos sozinho."],
  ];
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-3">
      <p className="text-sm font-medium text-[#101828]">Reel de teste (Instagram)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([v, label]) => (
          <button key={v || "normal"} type="button" onClick={() => onChange(v)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${value === v ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#667085]">{options.find(([v]) => v === value)?.[2]} Reel de teste não aparece no perfil.</p>
    </div>
  );
}
