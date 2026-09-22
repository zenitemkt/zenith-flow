"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";

function centsToAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function EditFinanceEntryButton({
  entryId,
  description: initialDescription,
  amountCents,
  dueDateISO,
}: {
  entryId: string;
  description: string;
  amountCents: number;
  dueDateISO: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(initialDescription);
  const [amount, setAmount] = useState(centsToAmountInput(amountCents));
  const [dueDate, setDueDate] = useState(dueDateISO);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setDescription(initialDescription);
    setAmount(centsToAmountInput(amountCents));
    setDueDate(dueDateISO);
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/finance/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        amount: Number(amount.replace(",", ".")),
        dueDate,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Editar lançamento"
        title="Editar lançamento"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054] hover:bg-[#F6F7FB]"
      >
        <Pencil size={13} aria-hidden />
      </button>
      <Modal open={open} onClose={close} title="Editar lançamento">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Descrição"
            name="description"
            required
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Valor (R$)"
              name="amount"
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1500,00"
            />
            <FormField
              label="Vencimento"
              name="dueDate"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
