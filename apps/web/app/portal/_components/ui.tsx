import type { InputHTMLAttributes, ReactNode } from "react";
import type { ContentStatus } from "@zenite-mkt/db";

/**
 * Tokens visuais do Portal do Cliente (identidade "zênite", 2026-09-24).
 * Noite #0A0B10 de base, superfícies "crepúsculo" levemente mais claras, texto
 * branco quente (#F5F2EE) em vez de branco puro, brasa #FF2B00 só pra ação e
 * pro que pede a atenção do cliente. Raio maior em painéis, menor em linhas,
 * pílula em ações — a hierarquia aparece na forma, não só na cor.
 */
export const panelClass =
  "rounded-[22px] border border-white/[0.07] bg-[#13141C]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm";

export const rowClass = "rounded-2xl border border-white/[0.06] bg-white/[0.025]";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A1A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B10]";

export const primaryButtonClass = `inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#FF2B00] px-5 text-sm font-semibold text-white shadow-[0_8px_28px_-8px_rgba(255,43,0,0.7)] transition-colors hover:bg-[#FF4419] disabled:opacity-60 ${focusRing}`;

export const ghostButtonClass = `inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-[#E7E4E0] transition-colors hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-60 ${focusRing}`;

export const quietButtonClass = `inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-[#A3A5B2] transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-60 ${focusRing}`;

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0C0D13] px-3.5 text-sm text-[#F5F2EE] placeholder:text-[#5E6070] outline-none transition-colors focus:border-[#FF2B00]/70 focus:ring-2 focus:ring-[#FF2B00]/20";

export const labelClass = "text-sm font-medium text-[#D6D3CF]";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="max-w-xl">
        <h1 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#F5F2EE] sm:text-[34px]">
          {title}
        </h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-[#A3A5B2]">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={`${panelClass} flex flex-col items-center px-6 py-14 text-center`}>
      <span aria-hidden className="mb-4 h-px w-16 bg-gradient-to-r from-transparent via-[#FF7A1A] to-transparent" />
      <p className="font-display text-lg font-semibold text-[#F5F2EE]">{title}</p>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#A3A5B2]">{children}</p>}
    </div>
  );
}

export function PortalField({
  label,
  id,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const fieldId = id ?? inputProps.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <input id={fieldId} className={`${inputClass} h-11`} {...inputProps} />
    </div>
  );
}

/**
 * Status da peça, do ponto de vista do cliente: o que importa é "precisa de
 * mim?", "já está certo?" ou "a equipe ainda está fazendo" — não as 10 etapas
 * internas do fluxo de conteúdo.
 */
export type ContentPhase = "waiting" | "adjusting" | "approved" | "producing";

export function contentPhase(status: ContentStatus): ContentPhase {
  if (status === "AGUARDANDO_CLIENTE") return "waiting";
  if (status === "AJUSTES") return "adjusting";
  if (status === "APROVADO" || status === "AGENDADO" || status === "PUBLICADO") return "approved";
  return "producing";
}

export const CONTENT_PHASE_LABELS: Record<ContentPhase, string> = {
  waiting: "Esperando você",
  adjusting: "Em ajuste",
  approved: "Aprovado",
  producing: "Em produção",
};

export const CONTENT_PHASE_DOT: Record<ContentPhase, string> = {
  waiting: "bg-[#FF2B00] shadow-[0_0_10px_rgba(255,43,0,0.8)]",
  adjusting: "bg-[#F5B544]",
  approved: "bg-[#3DD68C]",
  producing: "bg-[#8B8D9A]",
};
