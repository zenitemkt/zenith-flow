"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelinePeriod } from "@/lib/pipeline-period";

interface Props {
  initialPeriod: PipelinePeriod;
  initialYear?: string;
  initialMonth?: string;
  initialFrom?: string;
  initialTo?: string;
}

const OPTIONS: Array<{ value: PipelinePeriod; label: string }> = [
  { value: "all", label: "Todo o período" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "last14", label: "Últimos 14 dias" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "year", label: "Ano específico" },
  { value: "month", label: "Mês específico" },
  { value: "custom", label: "Período personalizado" },
];

export function PipelinePeriodFilter({ initialPeriod, initialYear, initialMonth, initialFrom, initialTo }: Props) {
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState<PipelinePeriod>(initialPeriod);
  const [year, setYear] = useState(initialYear ?? String(now.getFullYear()));
  const [month, setMonth] = useState(initialMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");

  function apply() {
    const query = new URLSearchParams({ period });
    if (period === "year") query.set("year", year);
    if (period === "month") query.set("month", month);
    if (period === "custom") {
      query.set("from", from);
      query.set("to", to);
    }
    router.push(`/comercial/pipeline?${query.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#E4E7EC] bg-white p-3">
      <label className="flex min-w-48 flex-col gap-1 text-xs font-medium text-[#475467]">
        Período dos indicadores
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as PipelinePeriod)}
          className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
        >
          {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {period === "year" && (
        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Ano
          <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} className="h-9 w-28 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
        </label>
      )}
      {period === "month" && (
        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Mês
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" />
        </label>
      )}
      {period === "custom" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" /></label>
        </>
      )}
      <button type="button" onClick={apply} disabled={period === "custom" && (!from || !to)} className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Aplicar filtro</button>
    </div>
  );
}
