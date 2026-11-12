"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

/**
 * Cliente da campanha, editável direto na lista. Campanhas da Meta entram sem
 * cliente; escolher aqui faz ela aparecer no filtro daquele cliente (Raio-X).
 * A sincronização nunca troca o cliente escolhido.
 */
export function CampaignClientSelect({
  campaignId,
  clientId,
  clients,
}: {
  campaignId: string;
  clientId: string | null;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(clientId ?? "");
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    const response = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: next || null }),
    });
    setSaving(false);
    if (!response.ok) {
      setValue(previous);
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível trocar o cliente.");
      return;
    }
    router.refresh();
  }

  return (
    <select
      aria-label="Cliente da campanha"
      value={value}
      disabled={saving}
      onChange={(e) => void change(e.target.value)}
      className="h-9 max-w-[200px] rounded-lg border border-[#D0D5DD] bg-white px-2 text-sm text-[#344054] outline-none focus:border-[#FF2B00] disabled:opacity-60"
    >
      <option value="">Própria agência</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
