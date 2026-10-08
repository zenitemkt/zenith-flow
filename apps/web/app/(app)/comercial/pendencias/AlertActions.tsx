"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AlertActions({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"RESOLVED" | "IGNORED" | null>(null);

  async function update(status: "RESOLVED" | "IGNORED") {
    setBusy(status);
    const response = await fetch(`/api/commercial-alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (response.ok) router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void update("RESOLVED")}
        className="rounded-md bg-[#16A36A] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy === "RESOLVED" ? "Salvando..." : "Resolver"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void update("IGNORED")}
        className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-medium text-[#475467] disabled:opacity-50"
      >
        {busy === "IGNORED" ? "Salvando..." : "Ignorar"}
      </button>
    </div>
  );
}
