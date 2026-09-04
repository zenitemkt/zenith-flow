"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AddCommentForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/requests/${requestId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    setLoading(false);
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(responseBody?.error ?? "Não foi possível salvar o comentário.");
      return;
    }

    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Comentar nesta demanda..."
        rows={2}
        className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
      />
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="self-end flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#6847F5" }}
      >
        {loading ? "Salvando..." : "Comentar"}
      </button>
    </form>
  );
}
