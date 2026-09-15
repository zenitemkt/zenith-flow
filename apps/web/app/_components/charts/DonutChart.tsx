"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatChartValue, type ChartValueFormat } from "./format";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

/**
 * Gráfico de pizza (donut) genérico — usado pelo X-RAY da agência pra
 * distribuições por categoria (status de cliente, banda de Health Score,
 * estágio da régua de cobrança etc.). Sempre client component: recharts não
 * roda em server component.
 *
 * `format` é uma string (não uma função) de propósito: props de Server pra
 * Client Component não podem carregar funções (Next.js App Router serializa
 * a árvore) — passar `valueFormatter` como closure quebra em runtime mesmo
 * compilando limpo no `tsc`. A formatação em si roda aqui dentro, no client.
 */
export function DonutChart({
  data,
  height = 200,
  format = "number",
  centerLabel,
}: {
  data: DonutDatum[];
  height?: number;
  format?: ChartValueFormat;
  /** Rótulo pequeno + total grande no centro do donut (ex.: "Total", "42"). */
  centerLabel?: string;
}) {
  const valueFormatter = (value: number) => formatChartValue(value, format);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-[#98A2B3]" style={{ height }}>
        Sem dado ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div style={{ height, width: height }} className="relative mx-auto shrink-0 sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? valueFormatter(value) : String(value),
                String(name),
              ]}
              contentStyle={{ borderRadius: 8, border: "1px solid #E4E7EC", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-medium text-[#98A2B3]">{centerLabel}</span>
            <span className="text-xl font-bold text-[#101828] [font-variant-numeric:tabular-nums]">
              {valueFormatter(total)}
            </span>
          </div>
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-[#475467]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium text-[#101828]">
              {valueFormatter(entry.value)} · {Math.round((entry.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
