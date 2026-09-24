"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function AddNoteForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);

      const response = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      setLoading(false);
      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        setError(responseBody?.error ?? "Não foi possível salvar a nota.");
        return;
      }

      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Registrar uma nota nesta timeline..."
        rows={2}
        className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
      />
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="self-end flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        {loading ? "Salvando..." : "Adicionar nota"}
      </button>
    </form>
  );
}
