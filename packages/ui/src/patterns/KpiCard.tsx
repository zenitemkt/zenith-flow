import type { ElementType, ReactNode } from "react";

export type Tone = "default" | "success" | "warn" | "danger";

const TONE_STYLES: Record<Tone, string> = {
  default: "bg-[#EEF4FF] text-[#2859B8]",
  success: "bg-[#DCFCE7] text-[#0B6B43]",
  warn: "bg-[#FFF2CC] text-[#9A5B00]",
  danger: "bg-[#FEE2E2] text-[#A11D1D]",
};

const ICON_TONE_STYLES: Record<Tone, string> = {
  default: "bg-[#FFF1EC] text-[#FF2B00]",
  success: "bg-[#DCFCE7] text-[#0B6B43]",
  warn: "bg-[#FFF2CC] text-[#9A5B00]",
  danger: "bg-[#FEE2E2] text-[#A11D1D]",
};

export interface KpiCardProps {
  label: string;
  value: string;
  trend?: string;
  tone?: Tone;
  href?: string;
  linkComponent?: ElementType;
  icon?: ReactNode;
}

/**
 * Cartão de indicador (protótipo `/prototype`, `.kpi`): rótulo, valor grande
 * e uma pílula de tendência colorida por tom semântico — nunca a cor sozinha
 * como único sinal (o texto da pílula sempre explica o estado).
 */
export function KpiCard({ label, value, trend, tone = "default", href, linkComponent, icon }: KpiCardProps) {
  const Wrapper = href ? (linkComponent ?? "a") : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex min-h-[140px] flex-col justify-between gap-3 rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-[#FF2B00]/50 hover:shadow-[0_4px_12px_rgba(16,24,40,0.06)]"
    >
      <div className="flex items-start justify-between gap-2">
        {icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ICON_TONE_STYLES[tone]}`}>
            {icon}
          </span>
        )}
        <span className="pt-1 text-xs font-medium text-[#667085]">{label}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[28px] font-bold leading-none tracking-normal text-[#101828] [font-variant-numeric:tabular-nums]">
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-bold ${TONE_STYLES[tone]}`}
          >
            {trend}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
