"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/**
 * Janelas de confirmação e aviso no visual do sistema (no lugar de window.confirm/alert do navegador).
 * Uso: `if (!(await confirmDialog("Apagar?", { danger: true }))) return;`
 */
export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação destrutiva (apagar, descartar, remover): botão vermelho. */
  danger?: boolean;
}

function Dialog({ message, options, alertOnly, onClose }: { message: string; options: ConfirmOptions; alertOnly: boolean; onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const title = options.title ?? (alertOnly ? "Aviso" : options.danger ? "Tem certeza?" : "Confirmar");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101828]/60 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="zf-dialog-title" className="w-full max-w-md rounded-2xl border border-[#EEF0F3] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${options.danger ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#FFF4ED] text-[#FF2B00]"}`}>!</span>
          <div className="min-w-0">
            <h2 id="zf-dialog-title" className="text-base font-semibold text-[#101828]">{title}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-[#475467]">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {!alertOnly && (
            <button type="button" onClick={() => onClose(false)} className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]">
              {options.cancelLabel ?? "Cancelar"}
            </button>
          )}
          <button ref={confirmRef} type="button" onClick={() => onClose(true)} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${options.danger ? "bg-[#D92D20] hover:bg-[#B42318]" : "bg-[#FF2B00] hover:bg-[#E02600]"}`}>
            {options.confirmLabel ?? (alertOnly ? "Entendi" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}

function open(message: string, options: ConfirmOptions, alertOnly: boolean): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let closed = false;
    const close = (ok: boolean) => {
      if (closed) return;
      closed = true;
      resolve(ok);
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    };
    root.render(<Dialog message={message} options={options} alertOnly={alertOnly} onClose={close} />);
  });
}

export const confirmDialog = (message: string, options: ConfirmOptions = {}) => open(message, options, false);
export const alertDialog = (message: string, options: ConfirmOptions = {}) => open(message, options, true).then(() => undefined);
