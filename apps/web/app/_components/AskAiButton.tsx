"use client";

import { useCommandPalette } from "@zenite-mkt/ui";

/** Abre o command palette global (Ctrl K) — CTA principal do cabeçalho da Home, como no protótipo. */
export function AskAiButton() {
  const { open } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={open}
      className="flex h-10 items-center justify-center rounded-[10px] bg-[#FF2B00] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,43,0,0.24)] hover:bg-[#E02600]"
    >
      Perguntar à AI
    </button>
  );
}
