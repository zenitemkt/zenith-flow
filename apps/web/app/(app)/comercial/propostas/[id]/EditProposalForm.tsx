"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Props {
  proposalId: string;
  initial: { name: string; content: string; valueCents: number | null };
}

export function EditProposalForm({ proposalId, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [content, setContent] = useState(initial.content);
  const [value, setValue] = useState(initial.valueCents !== null ? (initial.valueCents / 100).toString() : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, value: value ? Number(value.replace(",", ".")) : null }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-proposal-name" className="text-sm font-medium text-[#344054]">
          Nome
        </label>
        <input
          id="edit-proposal-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-proposal-content" className="text-sm font-medium text-[#344054]">
          Conteúdo
        </label>
        <textarea
          id="edit-proposal-content"
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="min-h-[120px] rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-proposal-value" className="text-sm font-medium text-[#344054]">
          Valor (R$)
        </label>
        <input
          id="edit-proposal-value"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
        />
      </div>

      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Salvando..." : "Salvar alterações"}
        </button>
        {saved && <span className="text-xs font-medium text-[#166534]">Salvo!</span>}
      </div>
    </form>
  );
}
