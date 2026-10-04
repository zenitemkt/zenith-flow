"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

interface Props {
  initialMeasurementId: string | null;
}

/** Configura o Measurement ID do GA4 (Etapa 3 do plano de Traqueamento) — dado público, só precisa ser salvo uma vez. */
export function Ga4MeasurementIdForm({ initialMeasurementId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [measurementId, setMeasurementId] = useState(initialMeasurementId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/integrations/ga4", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measurementId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível salvar o Measurement ID.");
        return;
      }
      toast.success("Measurement ID salvo.");
      router.refresh();
    } catch {
      toast.error("Erro de rede — tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-[#EEF0F3] px-4 py-3">
      <label className="flex flex-1 min-w-48 flex-col gap-1 text-xs font-medium text-[#475467]">
        Measurement ID do GA4
        <input
          type="text"
          value={measurementId}
          onChange={(event) => setMeasurementId(event.target.value)}
          placeholder="G-04ZTHTPT2J"
          className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving || !measurementId.trim()}
        className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
