"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

interface Props {
  initialPixelId: string | null;
}

/** Configura o Pixel ID da Meta (Etapa 2 do plano de Traqueamento) — dado público, usado junto com o token já conectado pra mandar eventos pela Conversions API. */
export function MetaPixelIdForm({ initialPixelId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pixelId, setPixelId] = useState(initialPixelId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/integrations/meta/pixel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível salvar o Pixel ID.");
        return;
      }
      toast.success("Pixel ID salvo.");
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
        Pixel ID da Meta (Conversions API)
        <input
          type="text"
          value={pixelId}
          onChange={(event) => setPixelId(event.target.value)}
          placeholder="1648887130161734"
          className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving || !pixelId.trim()}
        className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
