"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";

interface Item {
  id: string;
  title: string;
  description: string | null;
  status: "PENDENTE" | "BLOQUEADO" | "CONCLUIDO";
}

export function OnboardingChecklist({ items }: { items: Item[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function complete(itemId: string) {
    setError(null);
    setLoadingId(itemId);
    const response = await fetch(`/api/onboarding-items/${itemId}/complete`, { method: "POST" });
    setLoadingId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível concluir o item.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
            item.status === "CONCLUIDO"
              ? "border-[#DCFCE7] bg-[#F6FEFA]"
              : "border-[#E4E7EC] bg-white"
          }`}
        >
          <button
            type="button"
            disabled={item.status !== "PENDENTE" || loadingId === item.id}
            onClick={() => void complete(item.id)}
            aria-label={
              item.status === "CONCLUIDO"
                ? `${item.title} concluído`
                : item.status === "BLOQUEADO"
                  ? `${item.title} bloqueado`
                  : `Concluir ${item.title}`
            }
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              item.status === "CONCLUIDO"
                ? "border-[#16A36A] bg-[#16A36A] text-white"
                : item.status === "BLOQUEADO"
                  ? "border-[#D0D5DD] text-[#98A2B3]"
                  : "border-[#FF2B00] text-transparent hover:bg-[#FFF1EC]"
            }`}
          >
            {item.status === "CONCLUIDO" && <Check size={12} aria-hidden />}
            {item.status === "BLOQUEADO" && <Lock size={10} aria-hidden />}
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium ${
                item.status === "CONCLUIDO" ? "text-[#667085] line-through" : "text-[#101828]"
              }`}
            >
              {item.title}
            </p>
            {item.description && (
              <p className="text-xs text-[#98A2B3]">{item.description}</p>
            )}
          </div>
        </div>
      ))}
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
