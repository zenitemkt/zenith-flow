"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { PortalField, inputClass, labelClass, primaryButtonClass, quietButtonClass } from "../_components/ui";

export function NewPortalRequestModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setTitle("");
    setDescription("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível enviar a solicitação. Tente de novo.");
        return;
      }

      close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        <Plus size={16} aria-hidden />
        Nova solicitação
      </button>
      <Modal
        open={open}
        onClose={close}
        tone="dark"
        title="Nova solicitação"
        description="Conte o que você precisa. A equipe vê na hora e te responde por aqui."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PortalField
            label="O que você precisa?"
            name="title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: post sobre a promoção de sábado"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="portal-request-description" className={labelClass}>
              Detalhes (opcional)
            </label>
            <textarea
              id="portal-request-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Prazo, referências, textos que precisam aparecer…"
              className={`${inputClass} resize-none py-2.5`}
            />
          </div>

          {error && <p className="text-sm font-medium text-[#FF8A80]">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={close} className={quietButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Enviando…" : "Enviar solicitação"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
