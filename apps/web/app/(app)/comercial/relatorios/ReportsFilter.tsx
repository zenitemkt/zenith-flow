"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelinePeriod } from "@/lib/pipeline-period";

interface Props {
  initial: { period: PipelinePeriod; year?: string; month?: string; from?: string; to?: string; origin?: string; campaign?: string; service?: string };
  origins: string[];
  campaigns: string[];
  services: string[];
}

export function ReportsFilter({ initial, origins, campaigns, services }: Props) {
  const router = useRouter();
  const now = new Date();
  const [period, setPeriod] = useState(initial.period);
  const [year, setYear] = useState(initial.year ?? String(now.getFullYear()));
  const [month, setMonth] = useState(initial.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [origin, setOrigin] = useState(initial.origin ?? "");
  const [campaign, setCampaign] = useState(initial.campaign ?? "");
  const [service, setService] = useState(initial.service ?? "");

  function query() {
    const params = new URLSearchParams({ period });
    if (period === "year") params.set("year", year);
    if (period === "month") params.set("month", month);
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    if (origin) params.set("origin", origin);
    if (campaign) params.set("campaign", campaign);
    if (service) params.set("service", service);
    return params;
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-44 flex-col gap-1 text-xs font-medium text-[#475467]">Período
          <select value={period} onChange={(event) => setPeriod(event.target.value as PipelinePeriod)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm">
            <option value="last30">Últimos 30 dias</option><option value="last14">Últimos 14 dias</option><option value="last7">Últimos 7 dias</option><option value="all">Todo o período</option><option value="year">Ano específico</option><option value="month">Mês específico</option><option value="custom">Período personalizado</option>
          </select>
        </label>
        {period === "year" && <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">Ano<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} className="h-9 w-28 rounded-lg border border-[#D0D5DD] px-3 text-sm" /></label>}
        {period === "month" && <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">Mês<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" /></label>}
        {period === "custom" && <><label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" /></label><label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm" /></label></>}
        <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-[#475467]">Origem<select value={origin} onChange={(event) => setOrigin(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm"><option value="">Todas</option>{origins.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-[#475467]">Campanha<select value={campaign} onChange={(event) => setCampaign(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm"><option value="">Todas</option>{campaigns.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="flex min-w-40 flex-col gap-1 text-xs font-medium text-[#475467]">Serviço<select value={service} onChange={(event) => setService(event.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm"><option value="">Todos</option>{services.map((item) => <option key={item}>{item}</option>)}</select></label>
        <button type="button" disabled={period === "custom" && (!from || !to)} onClick={() => router.push(`/comercial/relatorios?${query()}`)} className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:opacity-50">Aplicar</button>
        <a href={`/api/commercial-reports/export?${query()}`} className="flex h-9 items-center rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]">Exportar CSV</a>
      </div>
    </div>
  );
}
