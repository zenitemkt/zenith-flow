"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

export function EditContentDetailsButton({
  contentId,
  initialTitle,
  initialDescription,
}: {
  contentId: string;
  initialTitle: string;
  initialDescription: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setTitle(initialTitle);
    setDescription(initialDescription);
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/content/${contentId}/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
      >
        <Pencil size={14} aria-hidden />
        Editar
      </button>
      <Modal open={open} onClose={close} title="Editar peça">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Título" name="title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="content-edit-description" className="text-sm font-medium text-[#344054]">
              Descrição (opcional)
            </label>
            <textarea
              id="content-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
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
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
