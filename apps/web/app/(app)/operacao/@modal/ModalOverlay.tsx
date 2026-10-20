"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Cartão aberto por cima do quadro. No celular vira tela cheia (sem margens,
 * rola a página inteira); no desktop é um painel largo centralizado.
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-[#101828]/50 sm:p-4 sm:pt-10"
      onClick={(event) => {
        if (event.target === event.currentTarget) router.back();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative min-h-[100dvh] w-full bg-white shadow-2xl sm:min-h-0 sm:max-w-5xl sm:rounded-2xl">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fechar"
          className="fixed right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#E4E7EC] bg-white/95 text-[#475467] shadow-sm backdrop-blur hover:bg-[#F6F7FB] sm:absolute sm:right-4 sm:top-4 sm:h-9 sm:w-9 sm:rounded-lg sm:border-0 sm:shadow-none"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="p-4 pt-5 sm:max-h-[86vh] sm:overflow-y-auto sm:p-6">{children}</div>
      </div>
    </div>
  );
}
