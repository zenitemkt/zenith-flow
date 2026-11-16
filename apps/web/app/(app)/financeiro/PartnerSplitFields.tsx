"use client";

import { useEffect, useState } from "react";
import { amountInputToCents, centsToInput, equalParts, splitTypedCents, type SplitFormValue } from "@/lib/finance-shares";
import { formatCents } from "@/lib/finance";

export interface PartnerChoice {
  id: string;
  name: string;
  active: boolean;
  userId?: string | null;
  /** Sócio com login próprio que não é o usuário atual: entra na Zenite, mas não como "Só fulano". */
  soloHidden?: boolean;
}

const SELECT = "h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

/**
 * Campo "de quem é" dos formulários do Financeiro e do cadastro do cliente:
 * sem divisão, um sócio só, ou dividido com o valor de cada um.
 * - `totalCents` (lançamento): mostra quanto falta/passou; com dois sócios,
 *   digitar o valor de um preenche o do outro com o restante.
 * - sem `totalCents` (padrão do cliente): os valores são só a referência da
 *   proporção.
 * Sócio desativado só aparece se já fizer parte da divisão atual.
 */
export function PartnerSplitFields({
  partners,
  value,
  onChange,
  totalCents,
  label,
  hint,
  idPrefix = "split",
  percent = false,
}: {
  partners: PartnerChoice[];
  value: SplitFormValue;
  onChange: (next: SplitFormValue) => void;
  totalCents?: number | null;
  label: string;
  hint?: string;
  idPrefix?: string;
  /** Divisão padrão do cliente: cada sócio em porcentagem. */
  percent?: boolean;
}) {
  const [equal, setEqual] = useState(false);
  const used = new Set([value.choice, ...Object.keys(value.amounts)]);
  const options = partners.filter((p) => p.active || used.has(p.id));

  const hasTotal = !percent && typeof totalCents === "number" && totalCents > 0;
  // Em porcentagem, "100%" = 10000 (mesma conta de centavos).
  const target = percent ? 10000 : hasTotal ? totalCents : 0;
  const typed = splitTypedCents(value);
  const diff = target ? target - typed : 0;
  const fmt = (cents: number) => (percent ? `${centsToInput(cents).replace(",00", "")}%` : formatCents(cents));

  function equalAmounts() {
    const parts = equalParts(target, options.length);
    return Object.fromEntries(options.map((p, i) => [p.id, centsToInput(parts[i]!)]));
  }

  // Dividir igualmente: acompanha o total do lançamento quando ele muda.
  useEffect(() => {
    if (equal && value.choice === "split" && target > 0) onChange({ choice: "split", amounts: equalAmounts() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equal, target, options.length]);

  if (options.length === 0) {
    return (
      <p className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs text-[#667085]">
        Para dividir entre os sócios, cadastre-os em Financeiro → Visão geral → Sócios.
      </p>
    );
  }

  function setAmount(partnerId: string, text: string) {
    const amounts = { ...value.amounts, [partnerId]: text };
    // Dois sócios e total conhecido: o outro fica com o restante.
    if (target > 0 && options.length === 2) {
      const other = options.find((p) => p.id !== partnerId)!;
      const cents = amountInputToCents(text);
      if (cents !== null && cents >= 0 && cents <= target) amounts[other.id] = centsToInput(target - cents);
    }
    onChange({ choice: "split", amounts });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${idPrefix}-choice`} className="text-sm font-medium text-[#344054]">
        {label}
      </label>
      <select
        id={`${idPrefix}-choice`}
        value={value.choice}
        onChange={(e) => onChange({ choice: e.target.value, amounts: e.target.value === "split" ? value.amounts : {} })}
        className={SELECT}
      >
        <option value="">Não definido</option>
        {options.length > 1 && <option value="split">Zenite (dividido entre os sócios)</option>}
        {options
          .filter((p) => !p.soloHidden || p.id === value.choice)
          .map((p) => (
            <option key={p.id} value={p.id}>
              Só {p.name} (particular)
            </option>
          ))}
      </select>

      {value.choice === "split" && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#EEF0F3] bg-[#F9FAFB] p-3">
          {(percent || hasTotal) && (
            <label className="flex items-center gap-2 text-xs font-medium text-[#344054]">
              <input type="checkbox" checked={equal} onChange={(e) => setEqual(e.target.checked)} className="h-4 w-4 accent-[#FF2B00]" />
              Dividir igualmente valores a receber
            </label>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((p) => (
              <label key={p.id} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#475467]">
                {p.name} ({percent ? "%" : "R$"})
                <input
                  type="text"
                  inputMode="decimal"
                  value={value.amounts[p.id] ?? ""}
                  onChange={(e) => setAmount(p.id, e.target.value)}
                  disabled={equal}
                  placeholder={percent ? "0" : "0,00"}
                  className="h-10 w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
                />
              </label>
            ))}
          </div>
          {target > 0 && (
            <p className={`text-xs font-medium ${diff === 0 ? "text-[#166534]" : "text-[#B42318]"}`}>
              {diff === 0
                ? `Fecha com o total de ${fmt(target)}.`
                : diff > 0
                  ? `Faltam ${fmt(diff)} para fechar ${fmt(target)}.`
                  : `Passou ${fmt(-diff)} do total de ${fmt(target)}.`}
            </p>
          )}
        </div>
      )}
      {hint && <p className="text-xs text-[#667085]">{hint}</p>}
    </div>
  );
}
