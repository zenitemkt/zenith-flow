"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

export function NewVersionModal({ contentId }: { contentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetUrl, setAssetUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setAssetUrl("");
    setNotes("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/content/${contentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetUrl, notes }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível adicionar a versão.");
      return;
    }

    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
      >
        + Nova versão
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Nova versão"
        description="Link do material (Drive, Figma, Canva...) — upload de arquivo chega numa próxima entrega."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Link do material"
            name="assetUrl"
            type="url"
            required
            autoFocus
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            placeholder="https://..."
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="version-notes" className="text-sm font-medium text-[#344054]">
              Notas (opcional)
            </label>
            <textarea
              id="version-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>

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
              {loading ? "Salvando..." : "Adicionar versão"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
