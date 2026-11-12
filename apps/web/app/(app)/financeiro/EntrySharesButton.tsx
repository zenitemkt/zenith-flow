"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { formatCents } from "@/lib/finance";
import { splitValueFromShares, splitValueToBody, type ShareInput } from "@/lib/finance-shares";
import { PartnerSplitFields, type PartnerChoice } from "./PartnerSplitFields";

/**
 * Célula "Sócios" da tabela: mostra de quem é o lançamento e abre o popup
 * para definir ou trocar (vale também para lançamento já recebido/pago).
 */
export function EntrySharesButton({
  entryId,
  type,
  amountCents,
  shares,
  partners,
  readOnly = false,
}: {
  entryId: string;
  type: "RECEITA" | "DESPESA";
  amountCents: number;
  shares: ShareInput[];
  partners: PartnerChoice[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => splitValueFromShares(shares));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nameOf = (id: string) => partners.find((p) => p.id === id)?.name ?? "Sócio";
  const summary =
    shares.length === 0
      ? "Definir"
      : shares.length === 1
        ? `${nameOf(shares[0]!.partnerId)} (particular)`
        : `Zenite · ${shares.map((s) => `${nameOf(s.partnerId)} ${formatCents(s.amountCents)}`).join(" · ")}`;

  if (readOnly || partners.length === 0) {
    return <span className="text-xs text-[#475467]">{shares.length === 0 ? "—" : summary}</span>;
  }

  function close() {
    setValue(splitValueFromShares(shares));
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/finance/entries/${entryId}/shares`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shares: splitValueToBody(value) }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar a divisão.");
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
        title="Definir de quem é este lançamento"
        className={`max-w-[260px] truncate rounded-md px-1.5 py-1 text-left text-xs font-medium hover:bg-[#F2F4F7] ${
          shares.length === 0 ? "text-[#98A2B3] underline decoration-dotted" : "text-[#344054]"
        }`}
      >
        {summary}
      </button>
      <Modal open={open} onClose={close} title="Divisão entre os sócios">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-[#667085]">Valor do lançamento: {formatCents(amountCents)}.</p>
          <PartnerSplitFields
            partners={partners}
            value={value}
            onChange={setValue}
            totalCents={amountCents}
            label={type === "RECEITA" ? "Quem recebe" : "De quem é a despesa"}
            idPrefix={`shares-${entryId}`}
          />
          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={close} className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]">
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
