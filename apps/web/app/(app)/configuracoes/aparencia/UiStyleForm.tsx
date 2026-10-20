"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UiStyle } from "@zenite-mkt/db";

const OPTIONS: { value: UiStyle; label: string; description: string }[] = [
  { value: "ZENITE", label: "Zênite", description: "O visual atual da plataforma, com tema claro ou escuro." },
  {
    value: "MINIMALISTA",
    label: "Minimalista",
    description: "Layout claro e limpo, com cartões arredondados e sombras suaves. Sempre claro.",
  },
];

export function UiStyleForm({ initialStyle }: { initialStyle: UiStyle }) {
  const router = useRouter();
  const [style, setStyle] = useState<UiStyle>(initialStyle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectStyle(next: UiStyle) {
    if (next === style || loading) return;
    setError(null);
    setLoading(true);

    const previous = style;
    setStyle(next);
    document.documentElement.classList.toggle("ui-minimal", next === "MINIMALISTA");

    const response = await fetch("/api/me/ui-style", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style: next }),
    });

    setLoading(false);
    if (!response.ok) {
      setStyle(previous);
      document.documentElement.classList.toggle("ui-minimal", previous === "MINIMALISTA");
      setError("Não foi possível salvar o estilo. Tente de novo.");
      return;
    }

    // O layout raiz decide `dark`/`ui-minimal` no servidor — recarrega pra refletir os dois.
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 dark:border-[#303343] dark:bg-[#171821]">
      <h2 className="mb-1 text-sm font-semibold text-[#101828] dark:text-white">Estilo</h2>
      <p className="mb-3 text-sm text-[#667085] dark:text-[#AEB4C5]">
        Vale só para a sua conta — os outros usuários continuam com o estilo que escolheram.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={loading}
            onClick={() => void selectStyle(option.value)}
            aria-pressed={style === option.value}
            className={`rounded-lg border p-3 text-left disabled:opacity-60 ${
              style === option.value
                ? "border-[#FF2B00] bg-[#FFF7F5]"
                : "border-[#D0D5DD] hover:bg-[#F9FAFB] dark:border-[#343747]"
            }`}
          >
            <span className="block text-sm font-semibold text-[#101828] dark:text-white">{option.label}</span>
            <span className="mt-0.5 block text-xs text-[#667085] dark:text-[#AEB4C5]">{option.description}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
