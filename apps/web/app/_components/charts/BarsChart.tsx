"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartValue, type ChartValueFormat } from "./format";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

/**
 * Gráfico de barras genérico (vertical, uma ou mais séries agrupadas) —
 * usado pelo X-RAY pra séries no tempo (fluxo de caixa, leads por mês) e
 * comparações categóricas (funil de pipeline, carga por pessoa).
 *
 * `format` é string, não função — ver o mesmo comentário em `DonutChart`.
 */
export function BarsChart({
  data,
  series,
  height = 220,
  layout = "horizontal",
  format = "number",
  barColors,
}: {
  data: Record<string, string | number>[];
  series: BarSeries[];
  height?: number;
  /** "horizontal" = barras verticais (categorias no eixo X); "vertical" = barras horizontais (categorias no eixo Y). */
  layout?: "horizontal" | "vertical";
  format?: ChartValueFormat;
  /** Cores alternadas por barra (cockpit/protótipo) — só tem efeito com uma única série. */
  barColors?: string[];
}) {
  const valueFormatter = (value: number) => formatChartValue(value, format);
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-[#98A2B3]" style={{ height }}>
        Sem dado ainda.
      </div>
    );
  }

  const isVertical = layout === "vertical";

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isVertical ? "vertical" : "horizontal"}
          margin={{ top: 4, right: 8, left: isVertical ? 8 : -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" horizontal={!isVertical} vertical={isVertical} />
          {isVertical ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#98A2B3" }} tickFormatter={valueFormatter} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: "#475467" }} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#98A2B3" }} />
              <YAxis tick={{ fontSize: 11, fill: "#98A2B3" }} tickFormatter={valueFormatter} width={48} />
            </>
          )}
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? valueFormatter(value) : String(value),
              String(name),
            ]}
            contentStyle={{ borderRadius: 8, border: "1px solid #E4E7EC", fontSize: 12 }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 4, 4]} maxBarSize={32}>
              {barColors &&
                series.length === 1 &&
                data.map((_, index) => <Cell key={index} fill={barColors[index % barColors.length]} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
