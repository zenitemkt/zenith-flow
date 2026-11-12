"use client";

import { amountInputToCents, centsToInput, splitTypedCents, type SplitFormValue } from "@/lib/finance-shares";
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
}: {
  partners: PartnerChoice[];
  value: SplitFormValue;
  onChange: (next: SplitFormValue) => void;
  totalCents?: number | null;
  label: string;
  hint?: string;
  idPrefix?: string;
}) {
  const used = new Set([value.choice, ...Object.keys(value.amounts)]);
  const options = partners.filter((p) => p.active || used.has(p.id));
  if (options.length === 0) {
    return (
      <p className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-xs text-[#667085]">
        Para dividir entre os sócios, cadastre-os em Financeiro → Visão geral → Sócios.
      </p>
    );
  }

  const hasTotal = typeof totalCents === "number" && totalCents > 0;
  const typed = splitTypedCents(value);
  const diff = hasTotal ? totalCents - typed : 0;

  function setAmount(partnerId: string, text: string) {
    const amounts = { ...value.amounts, [partnerId]: text };
    // Dois sócios e total conhecido: o outro fica com o restante.
    if (hasTotal && options.length === 2) {
      const other = options.find((p) => p.id !== partnerId)!;
      const cents = amountInputToCents(text);
      if (cents !== null && cents >= 0 && cents <= totalCents) amounts[other.id] = centsToInput(totalCents - cents);
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((p) => (
              <label key={p.id} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#475467]">
                {p.name} (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  value={value.amounts[p.id] ?? ""}
                  onChange={(e) => setAmount(p.id, e.target.value)}
                  placeholder="0,00"
                  className="h-10 w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
                />
              </label>
            ))}
          </div>
          {hasTotal && (
            <p className={`text-xs font-medium ${diff === 0 ? "text-[#166534]" : "text-[#B42318]"}`}>
              {diff === 0
                ? `Fecha com o total de ${formatCents(totalCents)}.`
                : diff > 0
                  ? `Faltam ${formatCents(diff)} para fechar ${formatCents(totalCents)}.`
                  : `Passou ${formatCents(-diff)} do total de ${formatCents(totalCents)}.`}
            </p>
          )}
        </div>
      )}
      {hint && <p className="text-xs text-[#667085]">{hint}</p>}
    </div>
  );
}
