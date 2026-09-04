"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

interface ClientOption {
  id: string;
  name: string;
}

export function NewRequestModal({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setTitle("");
    setDescription("");
    setRequesterName("");
    setClientId("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, requesterName, clientId: clientId || null }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a demanda.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/operacao/demandas/${body.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Nova demanda
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Nova demanda"
        description="Registre o pedido antes de virar tarefa — dá pra triar e priorizar depois."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Título"
            name="title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Criar peça para campanha de setembro"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="request-description" className="text-sm font-medium text-[#344054]">
              Descrição
            </label>
            <textarea
              id="request-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="request-client" className="text-sm font-medium text-[#344054]">
              Cliente (opcional)
            </label>
            <select
              id="request-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            >
              <option value="">Interna (sem cliente)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label="Solicitante (opcional)"
            name="requesterName"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            placeholder="Nome de quem pediu"
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
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Criando..." : "Criar demanda"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
