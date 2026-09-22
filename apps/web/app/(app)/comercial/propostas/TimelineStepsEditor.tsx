"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TimelineStep } from "@/lib/proposals";

interface Props {
  steps: TimelineStep[];
  onChange: (steps: TimelineStep[]) => void;
}

/** "Prazos e Etapas" — lista de passos (nome + dias) que vira a linha do tempo na proposta pública. Opcional. */
export function TimelineStepsEditor({ steps, onChange }: Props) {
  function updateStep(index: number, patch: Partial<TimelineStep>) {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function addStep() {
    onChange([...steps, { label: "", days: 0 }]);
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#344054]">Prazos e etapas (opcional)</label>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={step.label}
            onChange={(e) => updateStep(index, { label: e.target.value })}
            placeholder="Ex.: Assinatura do contrato"
            className="h-10 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
          />
          <input
            type="number"
            min={0}
            value={step.days}
            onChange={(e) => updateStep(index, { days: Number(e.target.value) })}
            placeholder="Dias"
            className="h-10 w-20 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#FF2B00]"
          />
          <button
            type="button"
            onClick={() => removeStep(index)}
            aria-label="Remover etapa"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#98A2B3] hover:bg-[#F6F7FB] hover:text-[#D94343]"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addStep}
        className="flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-dashed border-[#D0D5DD] px-3 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
      >
        <Plus size={14} aria-hidden />
        Adicionar etapa
      </button>
    </div>
  );
}
