"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VendorStatus } from "@zenith/db";

export function VendorStatusToggle({ vendorId, status }: { vendorId: string; status: VendorStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setLoading(true);
    const nextStatus: VendorStatus = status === "HOMOLOGADO" ? "BLOQUEADO" : "HOMOLOGADO";
    const response = await fetch(`/api/vendors/${vendorId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void toggle()}
        className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
      >
        {status === "HOMOLOGADO" ? "Bloquear" : "Homologar"}
      </button>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
