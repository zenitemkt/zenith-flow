"use client";

import { useState } from "react";
import { formatCents } from "@/lib/finance";

export interface DailyPoint {
  /** AAAA-MM-DD */
  date: string;
  spendCents: number;
  leads: number;
}

const W = 560;
const H = 160;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Um gráfico de barras por medida (gasto e leads têm escalas diferentes: nunca dois eixos no mesmo gráfico). */
function Bars({ title, total, points, value, format }: { title: string; total: string; points: DailyPoint[]; value: (p: DailyPoint) => number; format: (p: DailyPoint) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map(value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(18, slot - 2));
  const labelEvery = Math.ceil(points.length / 8);
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="min-w-0 flex-1 rounded-xl border border-[#E4E7EC] bg-white p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[#101828]">{title}</span>
        <span className="text-xs text-[#667085]">{active ? `${fmtDay(active.date)}: ${format(active)}` : `Total: ${total}`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-40 w-full" role="img" aria-label={`${title} por dia`} onMouseLeave={() => setHover(null)}>
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-[#E4E7EC]" strokeWidth={1} />
        {points.map((p, i) => {
          const v = value(p);
          const h = (v / max) * innerH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = H - PAD.bottom - h;
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              {/* Alvo de hover maior que a barra. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {v > 0 && <rect x={x} y={y} width={barW} height={Math.max(1, h)} rx={Math.min(4, barW / 2)} className={hover === i ? "fill-[#C42100]" : "fill-[#FF2B00]"} />}
              {i % labelEvery === 0 && (
                <text x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-[#98A2B3] text-[10px]">
                  {fmtDay(p.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-1 text-xs text-[#667085]">
        <summary className="cursor-pointer">Ver tabela</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {points.filter((p) => value(p) > 0).map((p) => (
              <tr key={p.date} className="border-t border-[#F2F4F7]">
                <td className="py-1">{fmtDay(p.date)}</td>
                <td className="py-1 text-right text-[#344054]">{format(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function DailyChart({ points }: { points: DailyPoint[] }) {
  const spend = points.reduce((n, p) => n + p.spendCents, 0);
  const leads = points.reduce((n, p) => n + p.leads, 0);
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Bars title="Gasto por dia" total={formatCents(spend)} points={points} value={(p) => p.spendCents} format={(p) => formatCents(p.spendCents)} />
      <Bars
        title="Leads por dia"
        total={`${leads.toLocaleString("pt-BR")}${leads ? ` · custo por lead ${formatCents(Math.round(spend / leads))}` : ""}`}
        points={points}
        value={(p) => p.leads}
        format={(p) => `${p.leads} lead(s)${p.leads ? ` · ${formatCents(Math.round(p.spendCents / p.leads))} por lead` : ""}`}
      />
    </div>
  );
}
