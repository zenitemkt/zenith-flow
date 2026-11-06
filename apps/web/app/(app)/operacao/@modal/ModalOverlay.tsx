"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Cartão aberto por cima do quadro. No celular vira tela cheia; no desktop é
 * um painel largo centralizado que cabe na tela (só o miolo rola).
 *
 * 2026-11-06: a barra com o "Fechar" agora é uma faixa própria no topo
 * (antes o X flutuava por cima do título e dos botões), e o painel não deixa
 * nada vazar na horizontal.
 */
export function ModalOverlay({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKeyDown);
    // Trava a rolagem do quadro por trás enquanto o cartão está aberto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#101828]/50 sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) router.back();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="zenite-modal relative flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:max-w-6xl sm:rounded-2xl">
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-[#EEF0F3] px-3 sm:px-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Fechar"
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            <X className="h-4 w-4" aria-hidden />
            Fechar
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
