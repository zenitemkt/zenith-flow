"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";
import { formatCents } from "@/lib/finance";
import { amountInputToCents, centsToInput } from "@/lib/finance-shares";
import type { PayoutPayment, PayoutSummary } from "@/lib/partner-payouts";

const STATUS: Record<PayoutSummary["status"], { label: string; cls: string }> = {
  nothing: { label: "—", cls: "text-[#98A2B3]" },
  pending: { label: "Pendente", cls: "bg-[#FEF3C7] text-[#92600A]" },
  partial: { label: "Parcial", cls: "bg-[#EEF2FF] text-[#3730A3]" },
  paid: { label: "Pago", cls: "bg-[#DCFCE7] text-[#166534]" },
};

function todaySP(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Situação do repasse do sócio no mês e o popup "Registrar pagamento": digita
 * o valor que foi transferido (pode ser parcial, e quantas vezes precisar).
 */
export function PayoutButton({
  partnerId,
  partnerName,
  month,
  monthLabel,
  summary,
  payments,
  canManage,
}: {
  partnerId: string;
  partnerName: string;
  /** "AAAA-MM" */
  month: string;
  monthLabel: string;
  summary: PayoutSummary;
  payments: PayoutPayment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todaySP());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = STATUS[summary.status];
  const typed = amountInputToCents(amount);

  function openModal() {
    setAmount(summary.pendingCents > 0 ? centsToInput(summary.pendingCents) : "");
    setPaidAt(todaySP());
    setNote("");
    setError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!typed || typed <= 0) return setError("Digite o valor que foi transferido.");
    setBusy(true);
    setError(null);
    const response = await fetch("/api/finance/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId, month, amount: typed / 100, paidAt, note }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return setError(body?.error ?? "Não foi possível registrar.");
    }
    setOpen(false);
    router.refresh();
  }

  async function remove(payment: PayoutPayment) {
    if (busy || !window.confirm(`Remover o pagamento de ${formatCents(payment.amountCents)}?`)) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/finance/payouts/${payment.id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return setError(body?.error ?? "Não foi possível remover.");
    }
    router.refresh();
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

  return (
    <div className="flex items-center justify-end gap-2">
      {summary.status === "nothing" ? (
        <span className="text-xs text-[#98A2B3]">—</span>
      ) : (
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      )}
      {(canManage || payments.length > 0) && summary.status !== "nothing" && (
        <button type="button" onClick={openModal} className="text-xs font-semibold text-[#FF2B00] hover:underline">
          {canManage ? "Registrar pagamento" : "Ver pagamentos"}
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Repasse a ${partnerName} — ${monthLabel}`}>
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
              <dt className="text-xs text-[#667085]">Parte no mês</dt>
              <dd className="font-semibold text-[#101828]">{formatCents(summary.totalCents)}</dd>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
              <dt className="text-xs text-[#667085]">Clientes ainda não pagaram</dt>
              <dd className="font-semibold text-[#101828]">{formatCents(summary.openCents)}</dd>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
              <dt className="text-xs text-[#667085]">Já repassado</dt>
              <dd className="font-semibold text-[#166534]">{formatCents(summary.paidCents)}</dd>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] px-3 py-2">
              <dt className="text-xs text-[#667085]">Pendente (já recebido, falta repassar)</dt>
              <dd className={`font-semibold ${summary.pendingCents > 0 ? "text-[#92600A]" : "text-[#101828]"}`}>{formatCents(summary.pendingCents)}</dd>
            </div>
          </dl>

          {payments.length > 0 && (
            <ul className="flex flex-col divide-y divide-[#EEF0F3] rounded-lg border border-[#E4E7EC] text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium text-[#101828]">{formatCents(p.amountCents)}</span>
                    <span className="text-[#667085]"> em {fmtDate(p.paidAtISO)}</span>
                    {p.note && <span className="block truncate text-xs text-[#98A2B3]">{p.note}</span>}
                  </span>
                  {canManage && (
                    <button type="button" disabled={busy} onClick={() => void remove(p)} className="shrink-0 text-xs font-semibold text-[#B42318] hover:underline disabled:opacity-60">
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
                  Valor transferido (R$)
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
                  Data da transferência
                  <input
                    type="date"
                    value={paidAt}
                    max={todaySP()}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
                  />
                </label>
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Observação (opcional)"
                className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
              {typed !== null && typed > 0 && typed > Math.max(summary.pendingCents, 0) && (
                <p className="text-xs font-medium text-[#92600A]">
                  Valor maior que o pendente ({formatCents(Math.max(summary.pendingCents, 0))}): a diferença fica como adiantamento.
                </p>
              )}
              {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]">
                  Fechar
                </button>
                <button type="submit" disabled={busy} className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#FF2B00" }}>
                  {busy ? "Salvando..." : "Registrar pagamento"}
                </button>
              </div>
            </form>
          )}
          {!canManage && error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
