"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

export function NewCandidateModal({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setEmail("");
    setPhone("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, name, email, phone }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível cadastrar o candidato.");
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
        className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        + Novo candidato
      </button>
      <Modal open={open} onClose={close} title="Novo candidato">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <FormField label="E-mail (opcional)" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormField label="Telefone (opcional)" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />

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
              {loading ? "Criando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
