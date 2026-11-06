"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";

const INPUT = "h-10 w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

/** Agora em São Paulo: { date: "AAAA-MM-DD", time: "HH:MM" }. */
function nowSP() {
  const iso = new Date(Date.now() - 3 * 3600_000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Sugestão: o mesmo horário de antes, no próximo dia em que ele ainda não passou. */
function suggestion(previousISO: string) {
  const previousTime = new Date(new Date(previousISO).getTime() - 3 * 3600_000).toISOString().slice(11, 16);
  const now = nowSP();
  if (previousTime > now.time) return { date: now.date, time: previousTime };
  const tomorrow = new Date(`${now.date}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { date: tomorrow.toISOString().slice(0, 10), time: previousTime };
}

/**
 * "Reagendar" uma publicação (falhou, agendada ou cancelada): nova data e
 * hora de Brasília. O post volta para a fila e a peça muda de dia no
 * Calendário (ver PATCH /api/social-posts/[id], action "reschedule").
 */
export function RescheduleSocialPostButton({
  postId,
  publishAtISO,
  label,
  className,
}: {
  postId: string;
  publishAtISO: string;
  /** Ex.: "Instagram · Story — Promoção de outubro" (vai no título da janela). */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    const s = suggestion(publishAtISO);
    setDate(s.date);
    setTime(s.time);
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (busy) return;
    const publishAt = new Date(`${date}T${time}:00-03:00`);
    if (!date || !time || Number.isNaN(publishAt.getTime())) return setError("Escolha a data e a hora.");
    if (publishAt.getTime() < Date.now()) return setError("Esse horário já passou. Escolha um no futuro.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/social-posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule", publishAt: publishAt.toISOString() }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error ?? "Não foi possível reagendar.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className ?? "inline-flex items-center gap-1 text-xs font-semibold text-[#FF2B00] hover:underline"}
      >
        <CalendarClock size={12} aria-hidden />
        Reagendar
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Reagendar publicação" description={label}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-[#344054]">
              Nova data
              <input type="date" value={date} min={nowSP().date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-[#344054]">
              Hora (Brasília)
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
            </label>
          </div>
          <p className="text-xs text-[#667085]">Ela volta para a fila e sai sozinha nesse horário. O cartão muda para esse dia no Calendário.</p>
          {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm text-[#B42318]">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="h-10 rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              <CalendarClock size={16} aria-hidden />
              {busy ? "Reagendando..." : "Reagendar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
