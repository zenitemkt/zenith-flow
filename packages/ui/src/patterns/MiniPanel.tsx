import type { ElementType, ReactNode } from "react";

export interface MiniPanelProps {
  title: string;
  children: ReactNode;
  ctaLabel: string;
  href?: string;
  onClick?: () => void;
  linkComponent?: ElementType;
  icon?: ReactNode;
}

/**
 * Painel de resumo por módulo (protótipo `/prototype`, `miniPanel`): usado
 * na Home para linkar rapidamente do cockpit executivo pra tela cheia do
 * módulo, sem tentar reproduzir o módulo inteiro na Home.
 */
export function MiniPanel({ title, children, ctaLabel, href, onClick, linkComponent, icon }: MiniPanelProps) {
  const CtaWrapper = href ? (linkComponent ?? "a") : "button";
  const ctaProps = href ? { href } : { type: "button" as const, onClick };

  return (
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
          {icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFF1EC] text-[#FF2B00]">
              {icon}
            </span>
          )}
          {title}
        </h3>
        <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-xs font-bold text-[#2859B8]">Resumo</span>
      </div>
      <p className="text-xs leading-relaxed text-[#667085]">{children}</p>
      <CtaWrapper
        {...ctaProps}
        className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-[#E4E7EC] bg-white px-3 text-xs font-bold text-[#344054] hover:bg-[#F9FAFB]"
      >
        {ctaLabel}
      </CtaWrapper>
    </section>
  );
}
