"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VendorOrderStatus } from "@zenith/db";
import { VENDOR_ORDER_STATUS_LABELS } from "@/lib/vendors";

export function OrderStatusActions({
  orderId,
  options,
}: {
  orderId: string;
  options: VendorOrderStatus[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(toStatus: VendorOrderStatus) {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/vendor-orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
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
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={loading}
            onClick={() => void move(option)}
            className="rounded-md border border-[#D0D5DD] px-2 py-1 text-[11px] font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-60"
          >
            {VENDOR_ORDER_STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
