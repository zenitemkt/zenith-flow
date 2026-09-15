"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  clientId: string;
  initialCompetitorName: string;
  initialEligible: boolean;
}

export function ReactivationInfoForm({ clientId, initialCompetitorName, initialEligible }: Props) {
  const router = useRouter();
  const [competitorName, setCompetitorName] = useState(initialCompetitorName);
  const [eligible, setEligible] = useState(initialEligible);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    const response = await fetch(`/api/clients/${clientId}/reactivation-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorName: competitorName || null, reactivationEligible: eligible }),
    });
    setLoading(false);
    if (response.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={competitorName}
        onChange={(e) => setCompetitorName(e.target.value)}
        placeholder="Concorrente (se informado)"
        className="h-8 w-48 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
      />
      <label className="flex items-center gap-1.5 text-xs text-[#344054]">
        <input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} />
        Elegível pra reativação
      </label>
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleSave()}
        className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] px-2 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
      >
        {loading ? "Salvando..." : "Salvar"}
      </button>
      {saved && <span className="text-xs font-medium text-[#166534]">Salvo!</span>}
    </div>
  );
}
