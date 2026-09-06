"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RotateWriteKeyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function rotate() {
    setLoading(true);
    const response = await fetch("/api/tracking/write-key", { method: "POST" });
    setLoading(false);
    setConfirming(false);
    if (response.ok) {
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#B42318]">Isso invalida o snippet já publicado no site.</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => void rotate()}
          className="rounded-lg bg-[#D94343] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Gerando..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054]"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB]"
    >
      Gerar nova chave
    </button>
  );
}
