"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenith/ui";
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
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lostTargetId, setLostTargetId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [stageBusyId, setStageBusyId] = useState<string | null>(null);

  /**
   * Espelho local de `opportunities`, atualizado otimisticamente antes da
   * resposta do servidor (mover/ganhar/perder não esperam o round-trip
   * completo para refletir na tela) e resincronizado sempre que o servidor
   * manda dados novos via `router.refresh()`.
   */
  const [localOpportunities, setLocalOpportunities] = useState(opportunities);
  useEffect(() => {
    setLocalOpportunities(opportunities);
  }, [opportunities]);

  const opportunitiesByStage = useMemo(() => {
    const map = new Map<string, BoardOpportunity[]>();
    for (const opp of localOpportunities) {
      const list = map.get(opp.stageId);
      if (list) list.push(opp);
      else map.set(opp.stageId, [opp]);
    }
    return map;
  }, [localOpportunities]);

  async function moveStage(stageId: string, direction: "left" | "right") {
    setError(null);
    setStageBusyId(stageId);
    const response = await fetch(`/api/pipeline-stages/${stageId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    setStageBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.error ?? "Não foi possível mover o estágio.";
      setError(message);
      toast.error(message);
      return;
    }
    router.refresh();
  }

  async function move(opportunityId: string, stageId: string, targetName: string) {
    setError(null);
    setBusyId(opportunityId);
    const previous = localOpportunities;
    setLocalOpportunities((current) =>
      current.map((opp) => (opp.id === opportunityId ? { ...opp, stageId } : opp)),
    );
    const response = await fetch(`/api/opportunities/${opportunityId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    setBusyId(null);
    if (!response.ok) {
      setLocalOpportunities(previous);
      const body = await response.json().catch(() => null);
      const message = body?.error ?? "Não foi possível mover a oportunidade.";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success(`Movida para ${targetName}.`);
    router.refresh();
  }

  async function markStatus(opportunityId: string, toStatus: "WON" | "LOST", reason: string | null) {
    setError(null);
    setBusyId(opportunityId);
    const previous = localOpportunities;
    setLocalOpportunities((current) => current.filter((opp) => opp.id !== opportunityId));
    const response = await fetch(`/api/opportunities/${opportunityId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, reason }),
    });
    setBusyId(null);
    if (!response.ok) {
      setLocalOpportunities(previous);
      const body = await response.json().catch(() => null);
      const message = body?.error ?? "Não foi possível atualizar a oportunidade.";
      setError(message);
      toast.error(message);
      return;
    }
    setLostTargetId(null);
    setLostReason("");
    toast.success(toStatus === "WON" ? "Oportunidade marcada como ganha." : "Oportunidade marcada como perdida.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, index) => {
          const stageOpportunities = opportunitiesByStage.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="flex min-w-[240px] flex-col gap-2">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                  {stage.name} · {stageOpportunities.length}
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
                            onClick={() => void move(opp.id, target.id, target.name)}
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
                          className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#FF2B00]"
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
