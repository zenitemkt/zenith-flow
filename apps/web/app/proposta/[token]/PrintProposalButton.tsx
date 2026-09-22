"use client";

import { Printer } from "lucide-react";

/** window.print() cobre "imprimir e levar na mão" sem precisar de lib de PDF — o navegador já oferece "Salvar como PDF" no diálogo de impressão. */
export function PrintProposalButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] print:hidden"
    >
      <Printer size={14} aria-hidden />
      Imprimir / Salvar PDF
    </button>
  );
}
