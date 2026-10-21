/**
 * Gráfico redondo de % concluída (pedido do usuário, 2026-10-20). SVG puro,
 * sem biblioteca: um trilho cinza e um arco proporcional ao percentual.
 * Acima de 100% o arco fecha e o número mostra o valor real (ex.: 128%).
 */
export function GoalRing({ percent, color, size = 132 }: { percent: number; color: string; size?: number }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const label = `${Math.round(percent)}%`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label} da meta`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF0F3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-[-0.02em] text-[#101828]">{label}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">concluída</span>
      </div>
    </div>
  );
}
