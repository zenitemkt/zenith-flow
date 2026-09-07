"use client";

import { useState } from "react";
import { Modal } from "@zenith/ui";
import { dueDateLabel, WORK_ITEM_STATUS_LABELS } from "@/lib/tasks";
import type { BoardTask } from "./OperationBoard";

export function TaskDetailModal({
  task,
  currentUserId,
  canManageAnyTask,
  onClose,
  onChanged,
}: {
  task: BoardTask;
  currentUserId: string;
  canManageAnyTask: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");

  async function post(path: string, body?: unknown) {
    setError(null);
    setLoading(true);
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(false);
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null);
      setError(responseBody?.error ?? "Não foi possível concluir a ação.");
      return false;
    }
    return true;
  }

  async function handleStart() {
    if (await post(`/api/tasks/${task.id}/start`)) onChanged();
  }

  async function handleComplete() {
    if (await post(`/api/tasks/${task.id}/complete`)) onChanged();
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    if (await post(`/api/tasks/${task.id}/cancel`, { reason: cancelReason.trim() })) onChanged();
  }

  async function toggleChecklistItem(itemId: string, done: boolean) {
    await post(`/api/tasks/${task.id}/checklist/${itemId}`, { done });
    onChanged();
  }

  async function addChecklistItem() {
    if (!newItemTitle.trim()) return;
    if (await post(`/api/tasks/${task.id}/checklist`, { title: newItemTitle.trim() })) {
      setNewItemTitle("");
      onChanged();
    }
  }

  const isActive = task.status === "BACKLOG" || task.status === "EM_ANDAMENTO";
  const blocked = task.blockedBy && task.blockedBy.status !== "CONCLUIDA";
  const canAct = canManageAnyTask || !task.assigneeUserId || task.assigneeUserId === currentUserId;

  return (
    <Modal open onClose={onClose} title={task.title}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#475467]">
            {WORK_ITEM_STATUS_LABELS[task.status]}
          </span>
          {task.clientName && (
            <span className="rounded-full bg-[#F1EDFE] px-2.5 py-1 text-xs font-medium text-[#6847F5]">
              {task.clientName}
            </span>
          )}
          <span className="text-xs text-[#98A2B3]">{dueDateLabel(task.dueDate ? new Date(task.dueDate) : null)}</span>
        </div>

        {task.description && <p className="text-sm text-[#475467]">{task.description}</p>}

        {blocked && (
          <p className="rounded-lg bg-[#FEF3C7] px-3 py-2 text-xs font-medium text-[#92600A]">
            Bloqueada por &quot;{task.blockedBy!.title}&quot; — precisa ser concluída primeiro.
          </p>
        )}

        {task.assignees.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Fila de responsáveis</p>
            <div className="flex flex-col gap-1">
              {task.assignees.map((a) => (
                <div
                  key={a.userId}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-sm ${
                    a.userId === task.assigneeUserId
                      ? "border-[#6847F5] bg-[#F1EDFE] font-medium text-[#6847F5]"
                      : a.completedAt
                        ? "border-[#DCFCE7] bg-[#F6FEFA] text-[#166534] line-through"
                        : "border-[#EEF0F3] text-[#475467]"
                  }`}
                >
                  <span>
                    {a.name}
                    {a.userId === currentUserId ? " (você)" : ""}
                  </span>
                  {a.userId === task.assigneeUserId && <span className="text-xs">vez dela(e)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Checklist</p>
          <div className="flex flex-col gap-1">
            {task.checklistItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm text-[#344054]">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => void toggleChecklistItem(item.id, e.target.checked)}
                />
                <span className={item.done ? "text-[#98A2B3] line-through" : ""}>{item.title}</span>
              </label>
            ))}
            {task.checklistItems.length === 0 && <p className="text-xs text-[#98A2B3]">Nenhum item ainda.</p>}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="Novo item"
              className="h-8 flex-1 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
            />
            <button
              type="button"
              onClick={() => void addChecklistItem()}
              className="rounded-md border border-[#D0D5DD] px-2 text-xs font-medium text-[#344054]"
            >
              Adicionar
            </button>
          </div>
        </div>

        {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

        {!canAct && (
          <p className="text-xs text-[#98A2B3]">Só quem está na vez (ou um admin) pode agir sobre esta tarefa.</p>
        )}

        {isActive && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {task.status === "BACKLOG" && (
                <button
                  type="button"
                  disabled={loading || Boolean(blocked) || !canAct}
                  onClick={() => void handleStart()}
                  className="flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#6847F5" }}
                >
                  Iniciar
                </button>
              )}
              {task.status === "EM_ANDAMENTO" && (
                <button
                  type="button"
                  disabled={loading || !canAct}
                  onClick={() => void handleComplete()}
                  className="flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#16A36A" }}
                >
                  Concluir
                </button>
              )}
              <button
                type="button"
                disabled={!canAct}
                onClick={() => setCancelling(true)}
                className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[#D0D5DD] text-sm font-medium text-[#344054] disabled:opacity-50"
              >
                Cancelar tarefa
              </button>
            </div>
            {cancelling && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-2.5">
                <input
                  autoFocus
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Motivo do cancelamento"
                  className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={!cancelReason.trim() || loading}
                    onClick={() => void handleCancel()}
                    className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: "#D94343" }}
                  >
                    Confirmar cancelamento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCancelling(false);
                      setCancelReason("");
                    }}
                    className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054]"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
