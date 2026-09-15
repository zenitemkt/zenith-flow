"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function ModalOverlay({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#101828]/50 p-4 pt-8 sm:pt-12"
      onClick={(event) => {
        if (event.target === event.currentTarget) router.back();
      }}
    >
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F6F7FB]"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="max-h-[85vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
