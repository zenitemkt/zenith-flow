"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** "lg" para conteúdo mais denso (ex.: detalhe de tarefa com checklist + comentários). */
  size?: "md" | "lg";
  /** "dark" só no Portal do Cliente, que tem identidade visual escura própria. */
  tone?: "light" | "dark";
  children: ReactNode;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Modal curto (seção 5 do manual: "somente decisões curtas / criações rápidas;
 * fluxos longos usam página ou painel lateral"). Usado para cadastros rápidos
 * que o usuário pode preencher parcialmente e completar depois.
 */
export function Modal({ open, onClose, title, description, size = "md", tone = "light", children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = panelRef.current ? getFocusable(panelRef.current) : [];
    focusable[0]?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const dark = tone === "dark";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className={`absolute inset-0 ${dark ? "bg-black/70 backdrop-blur-sm" : "bg-black/40"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={handleKeyDown}
        className={`relative flex max-h-[90vh] w-full flex-col shadow-xl ${
          dark
            ? "rounded-[22px] border border-white/10 bg-[#13141C] shadow-[0_40px_120px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]"
            : "rounded-2xl bg-white"
        } ${size === "lg" ? "max-w-2xl" : "max-w-md"}`}
      >
        <div
          className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${
            dark ? "border-white/[0.07]" : "border-[#EEF0F3]"
          }`}
        >
          <div>
            <h2
              id="modal-title"
              className={dark ? "font-display text-lg font-semibold tracking-[-0.01em] text-[#F5F2EE]" : "text-base font-semibold text-[#101828]"}
            >
              {title}
            </h2>
            {description && (
              <p className={`mt-0.5 text-sm ${dark ? "text-[#A3A5B2]" : "text-[#667085]"}`}>{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              dark ? "text-[#A3A5B2] hover:bg-white/[0.06] hover:text-white" : "text-[#667085] hover:bg-[#F6F7FB]"
            }`}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
