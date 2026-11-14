"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { confirmDialog } from "@/lib/dialogs";

/**
 * Janela do assistente de campanha (como a do mini-chat): as etapas Campanha → Revisão ficam
 * dentro dela, longe das abas do gestor, para não clicar na fileira errada.
 */
export function WizardModal({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();

  async function close() {
    const ok = await confirmDialog("Fechar o assistente? O que não foi salvo com \"Salvar rascunho\" ou ao trocar de etapa se perde.", { title: "Fechar campanha", confirmLabel: "Fechar" });
    if (!ok) return;
    router.push("/trafego-raio-x/gestor?aba=nova");
    router.refresh();
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      // Esc só fecha quando nenhuma outra janela (confirmação, editor de textos) está aberta por cima.
      if (e.key === "Escape" && !document.querySelector('[role="alertdialog"]')) void close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-[#101828]/60 p-0 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-[#F6F7FB] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E4E7EC] bg-white px-5 py-3">
          <p className="truncate text-sm font-semibold text-[#101828]">{title}</p>
          <button type="button" onClick={() => void close()} aria-label="Fechar" className="rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
