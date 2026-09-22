"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampaignStatus } from "@zenite-mkt/db";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/campaigns";

export function CampaignStatusActions({ campaignId, options }: { campaignId: string; options: CampaignStatus[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: CampaignStatus) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/campaigns/${campaignId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mudar o status.");
      return;
    }
    router.refresh();
  }

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => void submit(option)}
            className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {CAMPAIGN_STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
