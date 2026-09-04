"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

export function NewVendorModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setCategory("");
    setContactEmail("");
    setContactPhone("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, contactEmail, contactPhone }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar o fornecedor.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/operacao/fornecedores/${body.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Novo fornecedor
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Novo fornecedor"
        description="Só o nome é obrigatório — pode completar o contato depois."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Nome"
            name="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Estúdio de Áudio XYZ"
          />
          <FormField
            label="Categoria (opcional)"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Áudio, Impressão, Freelancer..."
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="E-mail"
              type="email"
              name="contactEmail"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <FormField
              label="Telefone"
              name="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
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
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Criando..." : "Criar fornecedor"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
