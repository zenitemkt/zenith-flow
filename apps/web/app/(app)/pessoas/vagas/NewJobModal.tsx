"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

interface PositionOption {
  id: string;
  title: string;
}

export function NewJobModal({ positions }: { positions: PositionOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [positionId, setPositionId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setTitle("");
    setPositionId("");
    setDescription("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, positionId: positionId || null, description }),
      });

      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível criar a vaga.");
        return;
      }

      const body = await response.json();
      close();
      router.push(`/pessoas/vagas/${body.id}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova vaga
      </button>
      <Modal open={open} onClose={close} title="Nova vaga" description="Cria um funil de candidatos próprio pra essa vaga.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Título da vaga" name="title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          {positions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="job-position" className="text-sm font-medium text-[#344054]">
                Cargo (opcional)
              </label>
              <select
                id="job-position"
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              >
                <option value="">Nenhum</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="job-description" className="text-sm font-medium text-[#344054]">
              Descrição (opcional)
            </label>
            <textarea
              id="job-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
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
              {loading ? "Criando..." : "Criar vaga"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
