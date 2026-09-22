"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { TimelineStepsEditor } from "./TimelineStepsEditor";
import type { TimelineStep } from "@/lib/proposals";

interface Option {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}

export function NewProposalModal({ clients, leads }: { clients: Option[]; leads: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [value, setValue] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
  const [clientId, setClientId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setContent("");
    setValue("");
    setPaymentTerms("");
    setTimelineSteps([]);
    setClientId("");
    setLeadId("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        content,
        value: value ? Number(value.replace(",", ".")) : null,
        paymentTerms: paymentTerms || null,
        timelineSteps: timelineSteps.filter((s) => s.label.trim()),
        clientId: clientId || null,
        leadId: leadId || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a proposta.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/comercial/propostas/${body.id}?send=1`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Nova proposta
      </button>
      <Modal open={open} onClose={close} title="Nova proposta" size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField label="Nome" name="name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="proposal-content" className="text-sm font-medium text-[#344054]">
              Escopo do projeto
            </label>
            <textarea
              id="proposal-content"
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="min-h-[120px] rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
              placeholder="Escopo, entregáveis, condições..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Investimento (R$, opcional)"
              name="value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="5000,00"
            />
            <FormField
              label="Forma de pagamento (opcional)"
              name="paymentTerms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="50% na assinatura, 50% na entrega"
            />
          </div>
          <TimelineStepsEditor steps={timelineSteps} onChange={setTimelineSteps} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="proposal-client" className="text-sm font-medium text-[#344054]">
                Cliente (opcional)
              </label>
              <select
                id="proposal-client"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  if (e.target.value) setLeadId("");
                }}
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
              <label htmlFor="proposal-lead" className="text-sm font-medium text-[#344054]">
                Lead (opcional)
              </label>
              <select
                id="proposal-lead"
                value={leadId}
                onChange={(e) => {
                  setLeadId(e.target.value);
                  if (e.target.value) setClientId("");
                }}
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
