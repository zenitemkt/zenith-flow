import type { ElementType, ReactNode } from "react";
import type { Tone } from "./KpiCard";

const TONE_STYLES: Record<Tone, string> = {
  default: "bg-[#EEF4FF] text-[#2859B8]",
  success: "bg-[#DCFCE7] text-[#0B6B43]",
  warn: "bg-[#FFF2CC] text-[#9A5B00]",
  danger: "bg-[#FEE2E2] text-[#A11D1D]",
};

export interface AttentionItem {
  key?: string;
  title: ReactNode;
  meta?: ReactNode;
  badge: string;
  tone?: Tone;
  href?: string;
}

export interface AttentionListProps {
  items: AttentionItem[];
  emptyLabel?: string;
  linkComponent?: ElementType;
}

/**
 * Lista "Precisa de atenção" (protótipo `/prototype`, `.attention`): cada
 * linha explica o que está acontecendo (título + meta) e o que fazer a
 * seguir (badge de tom semântico), pronta pra virar link de drill-down.
 */
export function AttentionList({ items, emptyLabel = "Nada pedindo atenção agora.", linkComponent }: AttentionListProps) {
  const Link = linkComponent ?? "a";

  if (items.length === 0) {
    return <p className="text-sm text-[#98A2B3]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, index) => {
        const Wrapper = item.href ? Link : "div";
        const wrapperProps = item.href ? { href: item.href } : {};
        return (
          <Wrapper
            key={item.key ?? index}
            {...wrapperProps}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#EEF0F3] bg-white px-3.5 py-3 transition-colors hover:border-[#FF2B00]/50 hover:bg-[#FFF9F7]"
          >
            <div className="min-w-0">
              <strong className="block truncate text-sm font-medium text-[#101828]">{item.title}</strong>
              {item.meta && <small className="block truncate text-xs text-[#667085]">{item.meta}</small>}
            </div>
            <span
              className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-xs font-bold ${TONE_STYLES[item.tone ?? "default"]}`}
            >
              {item.badge}
            </span>
          </Wrapper>
        );
      })}
    </div>
  );
}
