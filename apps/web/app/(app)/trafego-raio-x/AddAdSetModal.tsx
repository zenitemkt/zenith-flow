"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function AddAdSetModal({ campaignId, open, onClose }: { campaignId: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetingSummary, setTargetingSummary] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setName("");
    setTargetingSummary("");
    setBudget("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/ad-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetingSummary, budget: budget || null }),
      });
      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível criar o conjunto de anúncios.");
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={close} title="Novo conjunto de anúncios">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Segmentação (opcional)"
          name="targetingSummary"
          placeholder="Ex.: Mulheres 25-45, interesse em moda"
          value={targetingSummary}
          onChange={(e) => setTargetingSummary(e.target.value)}
        />
        <FormField
          label="Orçamento em R$ (opcional)"
          name="budget"
          type="number"
          min="0"
          step="0.01"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            {loading ? "Criando..." : "Criar conjunto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
