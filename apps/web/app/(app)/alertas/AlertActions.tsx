"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AlertActions({ id, status, href }: { id: string; status: "OPEN" | "RESOLVED" | "IGNORED"; href: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: "OPEN" | "RESOLVED" | "IGNORED") {
    setBusy(true);
    await fetch(`/api/system-alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    router.refresh();
  }

  const btn = "rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-medium text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50";
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      {href && (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={btn}>
          Ver
        </a>
      )}
      {status === "OPEN" ? (
        <>
          <button type="button" disabled={busy} onClick={() => set("RESOLVED")} className="rounded-lg bg-[#101828] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D2939] disabled:opacity-50">
            Resolver
          </button>
          <button type="button" disabled={busy} onClick={() => set("IGNORED")} className={btn}>
            Ignorar
          </button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => set("OPEN")} className={btn}>
          Reabrir
        </button>
      )}
    </div>
  );
}
