"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteContentButton({ contentId, title }: { contentId: string; title: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (loading) return;
    const confirmed = window.confirm(`Excluir "${title}"? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;

    setError(null);
    setLoading(true);
    const response = await fetch(`/api/content/${contentId}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setLoading(false);
      setError(body?.error ?? "Não foi possível excluir a peça.");
      return;
    }
    // Fecha voltando no histórico (não `push`) — o card aberto pode ser o
    // modal interceptado sobre `/operacao`; empurrar pra lá re-renderizaria
    // esta mesma página com o id já apagado antes de sair dela, disparando
    // `notFound()` e estourando a tela inteira.
    // `refresh()` chamado no mesmo instante que `back()` não pega o quadro
    // atualizado (a navegação de histórico ainda não terminou) — por isso
    // espera o `popstate` real da navegação antes de pedir os dados novos.
    window.addEventListener("popstate", () => router.refresh(), { once: true });
    router.back();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleDelete()}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#FEE4E2] px-3 text-sm font-medium text-[#D92D20] hover:bg-[#FEF3F2] disabled:opacity-60"
      >
        <Trash2 size={14} aria-hidden />
        {loading ? "Excluindo..." : "Excluir"}
      </button>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
