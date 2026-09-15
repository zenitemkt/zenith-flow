"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemePreference } from "@zenith/db";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "LIGHT", label: "Claro" },
  { value: "DARK", label: "Escuro" },
];

export function ThemeToggleForm({ initialTheme }: { initialTheme: ThemePreference }) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectTheme(next: ThemePreference) {
    if (next === theme || loading) return;
    setError(null);
    setLoading(true);

    // Aplica na hora (sem esperar o round-trip) — o servidor é a fonte de
    // verdade pra próxima vez que a pessoa logar em qualquer dispositivo.
    const previous = theme;
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "DARK");

    const response = await fetch("/api/me/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    });

    setLoading(false);
    if (!response.ok) {
      setTheme(previous);
      document.documentElement.classList.toggle("dark", previous === "DARK");
      setError("Não foi possível salvar o tema. Tente de novo.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 dark:border-[#303343] dark:bg-[#171821]">
      <h2 className="mb-1 text-sm font-semibold text-[#101828] dark:text-white">Tema</h2>
      <p className="mb-3 text-sm text-[#667085] dark:text-[#AEB4C5]">
        Escolha entre claro e escuro. Fica salvo na sua conta — não precisa escolher de novo da
        próxima vez que entrar, mesmo em outro dispositivo.
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={loading}
            onClick={() => void selectTheme(option.value)}
            aria-pressed={theme === option.value}
            className={`flex h-10 flex-1 items-center justify-center rounded-lg text-sm font-semibold disabled:opacity-60 ${
              theme === option.value
                ? "text-white"
                : "border border-[#D0D5DD] text-[#344054] dark:border-[#343747] dark:text-[#CFD3DF]"
            }`}
            style={theme === option.value ? { backgroundColor: "#FF2B00" } : undefined}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-[#D94343]">{error}</p>}
      <p className="mt-3 text-xs text-[#98A2B3]">
        Por enquanto o escuro se aplica à barra lateral, ao topo e ao fundo do app — deixar o
        conteúdo de cada tela (cards, tabelas, gráficos) escuro também é um trabalho maior, ainda
        pendente.
      </p>
    </div>
  );
}
