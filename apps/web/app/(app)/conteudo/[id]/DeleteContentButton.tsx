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
    router.push("/operacao");
    router.refresh();
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
