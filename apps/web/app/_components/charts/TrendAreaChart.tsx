"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartValue, type ChartValueFormat } from "./format";

/**
 * Gráfico de área com gradiente na cor da marca — usado no destaque principal
 * da Home ("Progress Overview" do protótipo de referência). Sempre client
 * component: recharts não roda em server component.
 */
export function TrendAreaChart({
  data,
  dataKey,
  labelKey = "label",
  height = 260,
  format = "number",
  color = "#FF2B00",
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  labelKey?: string;
  height?: number;
  format?: ChartValueFormat;
  color?: string;
}) {
  const valueFormatter = (value: number) => formatChartValue(value, format);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-[#98A2B3]" style={{ height }}>
        Sem dado ainda.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F3" vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: "#98A2B3" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "#98A2B3" }}
            tickFormatter={valueFormatter}
            width={48}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [typeof value === "number" ? valueFormatter(value) : String(value), ""]}
            contentStyle={{ borderRadius: 10, border: "1px solid #E4E7EC", fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: "#101828" }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            fill="url(#trendAreaFill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
