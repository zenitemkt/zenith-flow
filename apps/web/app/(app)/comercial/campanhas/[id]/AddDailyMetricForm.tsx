"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";

export function AddDailyMetricForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [spend, setSpend] = useState("");
  const [impressions, setImpressions] = useState("");
  const [reach, setReach] = useState("");
  const [clicks, setClicks] = useState("");
  const [results, setResults] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/campaigns/${campaignId}/daily-metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        spend: spend || 0,
        impressions: impressions || 0,
        reach: reach || null,
        clicks: clicks || 0,
        results: results || null,
        resultValue: resultValue || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar a métrica.");
      return;
    }

    setSpend("");
    setImpressions("");
    setReach("");
    setClicks("");
    setResults("");
    setResultValue("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-[#EEF0F3] bg-[#F9FAFB] p-3">
      <div className="w-36">
        <FormField label="Data" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="w-28">
        <FormField label="Gasto (R$)" name="spend" type="number" min="0" step="0.01" value={spend} onChange={(e) => setSpend(e.target.value)} />
      </div>
      <div className="w-28">
        <FormField label="Impressões" name="impressions" type="number" min="0" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
      </div>
      <div className="w-24">
        <FormField label="Alcance" name="reach" type="number" min="0" value={reach} onChange={(e) => setReach(e.target.value)} />
      </div>
      <div className="w-24">
        <FormField label="Cliques" name="clicks" type="number" min="0" value={clicks} onChange={(e) => setClicks(e.target.value)} />
      </div>
      <div className="w-24">
        <FormField label="Resultados" name="results" type="number" min="0" value={results} onChange={(e) => setResults(e.target.value)} />
      </div>
      <div className="w-32">
        <FormField
          label="Valor gerado (R$)"
          name="resultValue"
          type="number"
          min="0"
          step="0.01"
          value={resultValue}
          onChange={(e) => setResultValue(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        {loading ? "Salvando..." : "Salvar dia"}
      </button>
      {error && <p className="w-full text-xs font-medium text-[#D94343]">{error}</p>}
    </form>
  );
}
