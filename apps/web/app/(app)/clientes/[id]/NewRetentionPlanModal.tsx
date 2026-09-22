"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenite-mkt/ui";

interface TeamMember {
  userId: string;
  name: string;
}

const TEXTAREA_CLASS =
  "min-h-[72px] rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]";

export function NewRetentionPlanModal({ clientId, teamMembers }: { clientId: string; teamMembers: TeamMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alertReason, setAlertReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState(teamMembers[0]?.userId ?? "");
  const [planDescription, setPlanDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [reassessDate, setReassessDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setAlertReason("");
    setDiagnosis("");
    setPlanDescription("");
    setMeetingDate("");
    setReassessDate("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/clients/${clientId}/retention-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertReason,
        diagnosis,
        responsibleUserId,
        planDescription,
        meetingDate: meetingDate || null,
        reassessDate: reassessDate || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar o plano.");
      return;
    }

    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={teamMembers.length === 0}
        className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#FF2B00" }}
      >
        Criar plano de retenção
      </button>
      <Modal open={open} onClose={close} title="Novo plano de retenção">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="retention-alert" className="text-sm font-medium text-[#344054]">
              Motivo do alerta
            </label>
            <textarea
              id="retention-alert"
              required
              autoFocus
              value={alertReason}
              onChange={(e) => setAlertReason(e.target.value)}
              className={TEXTAREA_CLASS}
              placeholder="Ex.: Health caiu de 80 para 50 em 30 dias, duas faturas atrasadas."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="retention-diagnosis" className="text-sm font-medium text-[#344054]">
              Diagnóstico
            </label>
            <textarea
              id="retention-diagnosis"
              required
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="retention-responsible" className="text-sm font-medium text-[#344054]">
              Responsável
            </label>
            <select
              id="retention-responsible"
              required
              value={responsibleUserId}
              onChange={(e) => setResponsibleUserId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
            >
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="retention-plan" className="text-sm font-medium text-[#344054]">
              Plano de ação
            </label>
            <textarea
              id="retention-plan"
              required
              value={planDescription}
              onChange={(e) => setPlanDescription(e.target.value)}
              className={TEXTAREA_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="retention-meeting" className="text-sm font-medium text-[#344054]">
                Reunião (opcional)
              </label>
              <input
                id="retention-meeting"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="retention-reassess" className="text-sm font-medium text-[#344054]">
                Próxima reavaliação (opcional)
              </label>
              <input
                id="retention-reassess"
                type="date"
                value={reassessDate}
                onChange={(e) => setReassessDate(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
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
              {loading ? "Criando..." : "Criar plano"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
