"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JOB_STATUS_LABELS } from "@/lib/hr-jobs";
import type { JobStatus } from "@zenite-mkt/db";

export function JobStatusActions({ jobId, options }: { jobId: string; options: JobStatus[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(toStatus: JobStatus) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/jobs/${jobId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível atualizar a vaga.");
      return;
    }
    router.refresh();
  }

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => void submit(option)}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {JOB_STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
