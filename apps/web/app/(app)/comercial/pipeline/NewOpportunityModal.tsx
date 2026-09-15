"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

interface Option {
  id: string;
  name: string;
}

export function NewOpportunityModal({ clients, leads }: { clients: Option[]; leads: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [clientId, setClientId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setValue("");
    setClientId("");
    setLeadId("");
    setExpectedCloseDate("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        value: value ? Number(value.replace(",", ".")) : null,
        clientId: clientId || null,
        leadId: leadId || null,
        expectedCloseDate: expectedCloseDate || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a oportunidade.");
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
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova oportunidade
      </button>
      <Modal open={open} onClose={close} title="Nova oportunidade">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <FormField
            label="Valor estimado (R$, opcional)"
            name="value"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="5000,00"
          />
          <FormField
            label="Previsão de fechamento (opcional)"
            name="expectedCloseDate"
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="opportunity-client" className="text-sm font-medium text-[#344054]">
              Cliente (opcional)
            </label>
            <select
              id="opportunity-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            >
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="opportunity-lead" className="text-sm font-medium text-[#344054]">
              Lead (opcional)
            </label>
            <select
              id="opportunity-lead"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            >
              <option value="">Nenhum</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
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
              style={{ backgroundColor: "#FF2B00" }}
            >
              {loading ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
