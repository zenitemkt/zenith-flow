"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import type { WorkItemStatus } from "@zenith/db";
import { TASK_BOARD_COLUMNS, WORK_ITEM_STATUS_LABELS, WORK_ITEM_TRANSITIONS, isBlockedByDependency } from "@/lib/tasks";

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  assigneeUserId: string | null;
  blockedBy: { id: string; title: string; status: WorkItemStatus } | null;
}

interface PersonOption {
  userId: string;
  name: string;
}

export function TaskBoard({ tasks, people }: { tasks: BoardTask[]; people: PersonOption[] }) {
  const router = useRouter();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peopleByUserId = new Map(people.map((p) => [p.userId, p.name]));

  async function move(taskId: string, toStatus: WorkItemStatus) {
    setError(null);
    setMovingId(taskId);
    const response = await fetch(`/api/tasks/${taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus }),
    });
    setMovingId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover a tarefa.");
      return;
    }
    router.refresh();
  }

  async function reassign(taskId: string, userId: string) {
    setError(null);
    setAssigningId(taskId);
    const response = await fetch(`/api/tasks/${taskId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId || null }),
    });
    setAssigningId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível reatribuir a tarefa.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>
      )}
      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {TASK_BOARD_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column);
          return (
            <div key={column} className="flex min-w-[220px] flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
                {WORK_ITEM_STATUS_LABELS[column]} · {columnTasks.length}
              </p>
              <div className="flex flex-col gap-2">
                {columnTasks.map((task) => {
                  const nextOptions = WORK_ITEM_TRANSITIONS[task.status];
                  const blocked = task.blockedBy && task.blockedBy.status !== "CONCLUIDA";
                  return (
                    <div
                      key={task.id}
                      className="rounded-lg border border-[#E4E7EC] bg-white p-3 shadow-sm"
                    >
                      <p className="text-sm font-medium text-[#101828]">{task.title}</p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-[#98A2B3]">{task.description}</p>
                      )}
                      {blocked && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#B54708]">
                          <Lock size={11} aria-hidden />
                          Bloqueada por &quot;{task.blockedBy!.title}&quot;
                        </p>
                      )}
                      <select
                        aria-label={`Responsável por ${task.title}`}
                        value={task.assigneeUserId ?? ""}
                        disabled={assigningId === task.id}
                        onChange={(e) => void reassign(task.id, e.target.value)}
                        className="mt-2 h-8 w-full rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-1.5 text-xs text-[#475467] outline-none focus:border-[#6847F5]"
                      >
                        <option value="">Sem responsável</option>
                        {people.map((person) => (
                          <option key={person.userId} value={person.userId}>
                            {person.name}
                          </option>
                        ))}
                        {task.assigneeUserId && !peopleByUserId.has(task.assigneeUserId) && (
                          <option value={task.assigneeUserId}>Pessoa removida</option>
                        )}
                      </select>
                      {nextOptions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {nextOptions.map((option) => {
                            const disabled =
                              movingId === task.id || isBlockedByDependency(option, task.blockedBy?.status ?? null);
                            return (
                              <button
                                key={option}
                                type="button"
                                disabled={disabled}
                                onClick={() => void move(task.id, option)}
                                className="rounded-md border border-[#D0D5DD] px-2 py-1 text-[11px] font-medium text-[#344054] hover:bg-[#F6F7FB] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {WORK_ITEM_STATUS_LABELS[option]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {columnTasks.length === 0 && (
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
