"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { FINANCE_CATEGORY_NATURE_LABELS, DESPESA_CATEGORY_NATURES } from "@/lib/finance";
import type { FinanceEntryType, FinanceCategoryNature } from "@zenite-mkt/db";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

interface Option {
  id: string;
  name: string;
}

const NEW_CATEGORY = "__new__";

export function NewFinanceEntryModal({
  type,
  categories,
  clients,
  projects,
}: {
  type: FinanceEntryType;
  categories: Option[];
  clients: Option[];
  projects: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [competencyDate, setCompetencyDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryNature, setNewCategoryNature] = useState<FinanceCategoryNature>("DESPESA_OPERACIONAL");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  const label = type === "RECEITA" ? "Nova receita" : "Nova despesa";

  function close() {
    setDescription("");
    setAmount("");
    setDueDate("");
    setCategoryId("");
    setNewCategoryName("");
    setNewCategoryNature("DESPESA_OPERACIONAL");
    setClientId("");
    setProjectId("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);

      const response = await fetch("/api/finance/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          description,
          amount: Number(amount.replace(",", ".")),
          competencyDate,
          dueDate,
          categoryId: categoryId && categoryId !== NEW_CATEGORY ? categoryId : null,
          categoryName: categoryId === NEW_CATEGORY ? newCategoryName : null,
          categoryNature: categoryId === NEW_CATEGORY && type === "DESPESA" ? newCategoryNature : null,
          clientId: clientId || null,
          projectId: projectId || null,
        }),
      });

      setLoading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Não foi possível criar o lançamento.");
        return;
      }

      close();
      router.refresh();
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
        {label}
      </button>
      <Modal open={open} onClose={close} title={label}>
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
          <FormField
            label="Competência"
            name="competencyDate"
            type="date"
            required
            value={competencyDate}
            onChange={(e) => setCompetencyDate(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="finance-category" className="text-sm font-medium text-[#344054]">
              Categoria (opcional)
            </label>
            <select
              id="finance-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Nova categoria...</option>
            </select>
            {categoryId === NEW_CATEGORY && (
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nome da categoria"
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
            )}
            {categoryId === NEW_CATEGORY && type === "DESPESA" && (
              <select
                aria-label="Natureza da nova categoria"
                value={newCategoryNature}
                onChange={(e) => setNewCategoryNature(e.target.value as FinanceCategoryNature)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              >
                {DESPESA_CATEGORY_NATURES.map((nature) => (
                  <option key={nature} value={nature}>
                    {FINANCE_CATEGORY_NATURE_LABELS[nature]}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="finance-client" className="text-sm font-medium text-[#344054]">
                Cliente (opcional)
              </label>
              <select
                id="finance-client"
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
              <label htmlFor="finance-project" className="text-sm font-medium text-[#344054]">
                Projeto (opcional)
              </label>
              <select
                id="finance-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              >
                <option value="">Nenhum</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
