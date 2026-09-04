"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";

export function AddContactForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/clients/${clientId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível adicionar o contato.");
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-[#6847F5] hover:underline"
      >
        + Adicionar contato
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-[#E4E7EC] p-3">
      <FormField label="Nome" name="contact-name" required value={name} onChange={(e) => setName(e.target.value)} />
      <FormField label="E-mail" type="email" name="contact-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <FormField label="Telefone" name="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#6847F5" }}
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
