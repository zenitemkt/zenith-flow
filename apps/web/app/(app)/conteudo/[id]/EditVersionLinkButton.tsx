"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function EditVersionLinkButton({
  contentId,
  versionId,
  currentUrl,
}: {
  contentId: string;
  versionId: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [assetUrl, setAssetUrl] = useState(currentUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function open() {
    setAssetUrl(currentUrl ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/content/${contentId}/versions/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetUrl }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o link.");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="text-xs font-medium text-[#667085] hover:text-[#FF2B00] hover:underline"
      >
        Mudar link
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1.5 flex flex-col gap-1.5">
      <input
        type="url"
        autoFocus
        required
        value={assetUrl}
        onChange={(e) => setAssetUrl(e.target.value)}
        placeholder="https://..."
        className="h-9 rounded-lg border border-[#D0D5DD] px-2.5 text-sm outline-none focus:border-[#FF2B00]"
      />
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex h-7 items-center justify-center rounded-md px-3 text-xs font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex h-7 items-center justify-center rounded-md border border-[#D0D5DD] px-3 text-xs font-medium text-[#344054]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
