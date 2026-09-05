"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatOpportunityValue } from "@/lib/pipeline";

export interface BoardStage {
  id: string;
  name: string;
  order: number;
}

export interface BoardOpportunity {
  id: string;
  name: string;
  stageId: string;
  valueCents: number | null;
  clientName: string | null;
  leadName: string | null;
  expectedCloseDate: string | null;
}

export function PipelineBoard({ stages, opportunities }: { stages: BoardStage[]; opportunities: BoardOpportunity[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lostTargetId, setLostTargetId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function move(opportunityId: string, stageId: string) {
    setError(null);
    setBusyId(opportunityId);
    const response = await fetch(`/api/opportunities/${opportunityId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover a oportunidade.");
      return;
    }
    router.refresh();
  }

  async function markStatus(opportunityId: string, toStatus: "WON" | "LOST", reason: string | null) {
    setError(null);
    setBusyId(opportunityId);
    const response = await fetch(`/api/opportunities/${opportunityId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason }),
    });
    setBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível atualizar a oportunidade.");
      return;
    }
    setLostTargetId(null);
    setLostReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const stageOpportunities = opportunities.filter((o) => o.stageId === stage.id);
          return (
            <div key={stage.id} className="flex min-w-[240px] flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                {stage.name} · {stageOpportunities.length}
              </p>
              <div className="flex flex-col gap-2">
                {stageOpportunities.map((opp) => (
                  <div key={opp.id} className="rounded-lg border border-[#E4E7EC] bg-white p-3 shadow-sm">
                    <p className="text-sm font-medium text-[#101828]">{opp.name}</p>
                    <p className="text-xs text-[#98A2B3]">{opp.clientName ?? opp.leadName ?? "Sem vínculo"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#166534]">{formatOpportunityValue(opp.valueCents)}</p>
                    {opp.expectedCloseDate && (
                      <p className="text-xs text-[#98A2B3]">
                        Fechamento previsto: {new Date(opp.expectedCloseDate).toLocaleDateString("pt-BR")}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {stages
                        .filter((s) => s.id !== stage.id)
                        .map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            disabled={busyId === opp.id}
                            onClick={() => void move(opp.id, target.id)}
                            className="rounded-md border border-[#D0D5DD] px-2 py-1 text-[11px] font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-40"
                          >
                            {target.name}
                          </button>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        disabled={busyId === opp.id}
                        onClick={() => void markStatus(opp.id, "WON", null)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-40"
                        style={{ backgroundColor: "#16A36A" }}
                      >
                        Ganha
                      </button>
                      <button
                        type="button"
                        disabled={busyId === opp.id}
                        onClick={() => setLostTargetId(opp.id)}
                        className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:opacity-40"
                      >
                        Perdida
                      </button>
                    </div>

                    {lostTargetId === opp.id && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <input
                          autoFocus
                          value={lostReason}
                          onChange={(e) => setLostReason(e.target.value)}
                          placeholder="Motivo da perda"
                          className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={!lostReason.trim() || busyId === opp.id}
                            onClick={() => void markStatus(opp.id, "LOST", lostReason.trim())}
                            className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-40"
                            style={{ backgroundColor: "#D94343" }}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLostTargetId(null);
                              setLostReason("");
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
                {stageOpportunities.length === 0 && (
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
