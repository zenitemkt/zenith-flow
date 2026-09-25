"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function AddAdModal({
  campaignId,
  adSetId,
  open,
  onClose,
}: {
  campaignId: string;
  adSetId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creativeNote, setCreativeNote] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setName("");
    setCreativeNote("");
    setAssetUrl("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);
      const response = await fetch(`/api/campaigns/${campaignId}/ad-sets/${adSetId}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, creativeNote, assetUrl }),
      });
      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível criar o anúncio.");
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <Modal open={open} onClose={close} title="Novo anúncio">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        <FormField
          label="Copy/descrição (opcional)"
          name="creativeNote"
          value={creativeNote}
          onChange={(e) => setCreativeNote(e.target.value)}
        />
        <FormField
          label="Link da peça (opcional)"
          name="assetUrl"
          type="url"
          placeholder="Link do Drive ou da peça publicada"
          value={assetUrl}
          onChange={(e) => setAssetUrl(e.target.value)}
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
            {loading ? "Criando..." : "Criar anúncio"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
