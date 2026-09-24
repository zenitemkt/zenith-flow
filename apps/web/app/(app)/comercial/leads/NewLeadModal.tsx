"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function NewLeadModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setSource("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, company, source }),
      });

      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível criar o lead.");
        return;
      }

      const body = await response.json();
      close();
      router.push(`/comercial/leads/${body.id}`);
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
        Novo lead
      </button>
      <Modal open={open} onClose={close} title="Novo lead">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <FormField
            label="E-mail (opcional)"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormField label="Telefone (opcional)" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <FormField label="Empresa (opcional)" name="company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <FormField
            label="Origem (opcional)"
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Indicação, formulário do site, evento..."
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
              {loading ? "Criando..." : "Criar lead"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
