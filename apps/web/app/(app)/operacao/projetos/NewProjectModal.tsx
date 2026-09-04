"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

interface ClientOption {
  id: string;
  name: string;
}

export function NewProjectModal({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setClientId("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, clientId: clientId || null }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar o projeto.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/operacao/projetos/${body.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Novo projeto
      </button>
      <Modal open={open} onClose={close} title="Novo projeto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Nome do projeto"
            name="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campanha de lançamento"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-client" className="text-sm font-medium text-[#344054]">
              Cliente (opcional)
            </label>
            <select
              id="project-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#101828] outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            >
              <option value="">Interno (sem cliente)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
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
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Criando..." : "Criar projeto"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
