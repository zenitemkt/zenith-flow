"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface BoardStage {
  id: string;
  name: string;
  order: number;
}

export interface BoardCandidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stageId: string;
}

export function JobStageBoard({ stages, candidates }: { stages: BoardStage[]; candidates: BoardCandidate[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stageBusyId, setStageBusyId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function moveStage(stageId: string, direction: "left" | "right") {
    setError(null);
    setStageBusyId(stageId);
    const response = await fetch(`/api/job-stages/${stageId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    setStageBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover o estágio.");
      return;
    }
    router.refresh();
  }

  async function move(candidateId: string, stageId: string) {
    setError(null);
    setBusyId(candidateId);
    const response = await fetch(`/api/candidates/${candidateId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover o candidato.");
      return;
    }
    router.refresh();
  }

  async function convert(candidateId: string) {
    setError(null);
    setBusyId(candidateId);
    const response = await fetch(`/api/candidates/${candidateId}/convert`, { method: "POST" });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível contratar o candidato.");
      return;
    }
    router.refresh();
  }

  async function decide(candidateId: string, toStatus: "REJEITADO" | "DESISTIU", reason: string | null) {
    setError(null);
    setBusyId(candidateId);
    const response = await fetch(`/api/candidates/${candidateId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível atualizar o candidato.");
      return;
    }
    setRejectTargetId(null);
    setRejectReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, index) => {
          const stageCandidates = candidates.filter((c) => c.stageId === stage.id);
          return (
            <div key={stage.id} className="flex min-w-[240px] flex-col gap-2">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                  {stage.name} · {stageCandidates.length}
                </p>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0 || stageBusyId === stage.id}
                    onClick={() => void moveStage(stage.id, "left")}
                    aria-label={`Mover ${stage.name} para a esquerda`}
                    className="flex h-5 w-5 items-center justify-center rounded border border-[#D0D5DD] text-[10px] text-[#344054] disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={index === stages.length - 1 || stageBusyId === stage.id}
                    onClick={() => void moveStage(stage.id, "right")}
                    aria-label={`Mover ${stage.name} para a direita`}
                    className="flex h-5 w-5 items-center justify-center rounded border border-[#D0D5DD] text-[10px] text-[#344054] disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {stageCandidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-lg border border-[#E4E7EC] bg-white p-3 shadow-sm">
                    <p className="text-sm font-medium text-[#101828]">{candidate.name}</p>
                    <p className="text-xs text-[#98A2B3]">{candidate.email ?? candidate.phone ?? "Sem contato"}</p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {stages
                        .filter((s) => s.id !== stage.id)
                        .map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            disabled={busyId === candidate.id}
                            onClick={() => void move(candidate.id, target.id)}
                            className="rounded-md border border-[#D0D5DD] px-2 py-1 text-[11px] font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-40"
                          >
                            {target.name}
                          </button>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        disabled={busyId === candidate.id}
                        onClick={() => void convert(candidate.id)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-40"
                        style={{ backgroundColor: "#16A36A" }}
                      >
                        Contratar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === candidate.id}
                        onClick={() => void decide(candidate.id, "DESISTIU", null)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054] disabled:opacity-40"
                      >
                        Desistiu
                      </button>
                      <button
                        type="button"
                        disabled={busyId === candidate.id}
                        onClick={() => setRejectTargetId(candidate.id)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054] disabled:opacity-40"
                      >
                        Rejeitar
                      </button>
                    </div>

                    {rejectTargetId === candidate.id && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <input
                          autoFocus
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Motivo da rejeição"
                          className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={!rejectReason.trim() || busyId === candidate.id}
                            onClick={() => void decide(candidate.id, "REJEITADO", rejectReason.trim())}
                            className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-40"
                            style={{ backgroundColor: "#D94343" }}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectTargetId(null);
                              setRejectReason("");
                            }}
                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054]"
                          >
                            Voltar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {stageCandidates.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#E4E7EC] px-3 py-4 text-center text-xs text-[#98A2B3]">
                    Vazio
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
