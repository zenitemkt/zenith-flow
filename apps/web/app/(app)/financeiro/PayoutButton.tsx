"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/finance";

/**
 * Repasse do mês ao sócio: "Pendente" vira "Pago" quando a transferência é
 * feita (e volta, se foi marcado por engano). Se entrou recebimento depois da
 * baixa, mostra a diferença e deixa atualizar.
 */
export function PayoutButton({
  partnerId,
  partnerName,
  month,
  dueCents,
  paid,
  paidCents,
  paidAtISO,
  canManage,
}: {
  partnerId: string;
  partnerName: string;
  /** "AAAA-MM" */
  month: string;
  dueCents: number;
  paid: boolean;
  paidCents: number | null;
  paidAtISO: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(nextPaid: boolean) {
    if (busy) return;
    const question = nextPaid
      ? `Marcar como pago o repasse de ${formatCents(dueCents)} para ${partnerName}?`
      : `Voltar o repasse de ${partnerName} para pendente?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/finance/payouts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId, month, paid: nextPaid }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    router.refresh();
  }

  if (!paid && dueCents <= 0) return <span className="text-xs text-[#98A2B3]">Nada a repassar</span>;

  const diff = paid && paidCents !== null ? dueCents - paidCents : 0;
  const badge = paid ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92600A]";
  const label = paid ? "Pago" : "Pendente";

  return (
    <div className="flex flex-col items-end gap-1">
      {canManage ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void set(!paid)}
          title={paid ? "Clique para voltar a pendente" : "Clique quando a transferência for feita"}
          className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-60 ${badge}`}
        >
          {busy ? "Salvando..." : label}
        </button>
      ) : (
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge}`}>{label}</span>
      )}
      {paid && paidAtISO && (
        <span className="text-[11px] text-[#667085]">
          {formatCents(paidCents ?? 0)} em {new Date(paidAtISO).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </span>
      )}
      {paid && diff !== 0 && (
        <span className="text-[11px] font-medium text-[#B42318]">
          {diff > 0 ? `Faltam ${formatCents(diff)}` : `Pago ${formatCents(-diff)} a mais`}
          {canManage && diff > 0 && (
            <button type="button" disabled={busy} onClick={() => void set(true)} className="ml-1 underline">
              atualizar
            </button>
          )}
        </span>
      )}
      {error && <span className="text-[11px] text-[#B42318]">{error}</span>}
    </div>
  );
}
