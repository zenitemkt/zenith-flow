"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

export function DisconnectMetaButton() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function disconnect() {
    setLoading(true);
    const response = await fetch("/api/integrations/meta/disconnect", { method: "POST" });
    setLoading(false);
    setConfirming(false);
    if (response.ok) {
      toast.success("Conta da Meta desconectada.");
      router.refresh();
    } else {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Não foi possível desconectar.");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#B42318]">Desconectar não apaga dados já lidos.</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => void disconnect()}
          className="rounded-lg bg-[#D94343] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Desconectando..." : "Confirmar"}
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
      Desconectar
    </button>
  );
}
