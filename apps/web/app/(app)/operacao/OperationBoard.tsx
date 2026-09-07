"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { WorkItemStatus } from "@zenith/db";
import { dueDateLabel } from "@/lib/tasks";
import { TaskDetailModal } from "./TaskDetailModal";

export interface PersonOption {
  userId: string;
  name: string;
}

export interface StageOption {
  id: string;
  name: string;
  order: number;
}

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  stageId: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  completedAt: string | null;
  clientId: string | null;
  clientName: string | null;
  assigneeUserId: string | null;
  blockedBy: { id: string; title: string; status: WorkItemStatus } | null;
  assignees: { userId: string; name: string; order: number; completedAt: string | null }[];
  checklistItems: { id: string; title: string; done: boolean }[];
}

interface Column {
  id: string;
  title: string;
  laneStatus: WorkItemStatus;
  stageId: string | null;
  tasks: BoardTask[];
}

function sortByDueDate(tasks: BoardTask[]): BoardTask[] {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

function TaskCard({ task, canDrag, onOpen }: { task: BoardTask; canDrag: boolean; onOpen: (task: BoardTask) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;
  const blocked = task.blockedBy && task.blockedBy.status !== "CONCLUIDA";
  const overdue = task.dueDate && !task.completedAt && new Date(task.dueDate).getTime() < Date.now();
  const doneCount = task.checklistItems.filter((c) => c.done).length;
  const dragProps = canDrag ? { ...listeners, ...attributes } : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dragProps}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isDragging) onOpen(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task);
      }}
      title={canDrag ? undefined : "Só quem está na vez (ou um admin) pode mover este card"}
      className={`cursor-pointer touch-none rounded-lg border bg-white p-3 shadow-sm hover:border-[#6847F5] ${
        isDragging ? "opacity-50" : ""
      } ${overdue ? "border-[#FDA29B]" : "border-[#E4E7EC]"}`}
    >
      {task.clientName && (
        <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wide text-[#6847F5]">
          {task.clientName}
        </p>
      )}
      <p className="text-sm font-medium text-[#101828]">{task.title}</p>
      {blocked && (
        <p className="mt-1 text-xs font-medium text-[#B54708]">Bloqueada por &quot;{task.blockedBy!.title}&quot;</p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={overdue ? "font-medium text-[#B42318]" : "text-[#98A2B3]"}>
          {dueDateLabel(task.dueDate ? new Date(task.dueDate) : null)}
        </span>
        {task.estimatedMinutes !== null && (
          <span className="text-[#98A2B3]">
            · {task.estimatedMinutes >= 60 ? `${Math.round(task.estimatedMinutes / 60)}h` : `${task.estimatedMinutes}min`}
          </span>
        )}
        {task.checklistItems.length > 0 && (
          <span className="text-[#98A2B3]">
            · {doneCount}/{task.checklistItems.length}
          </span>
        )}
      </div>
      {task.assignees.length > 1 && (
        <p className="mt-1 text-[10px] text-[#98A2B3]">
          Vez de: {task.assignees.find((a) => a.userId === task.assigneeUserId)?.name ?? "—"}
        </p>
      )}
    </div>
  );
}

function BoardColumn({
  column,
  canDragTask,
  onOpen,
  reorder,
}: {
  column: Column;
  canDragTask: (task: BoardTask) => boolean;
  onOpen: (task: BoardTask) => void;
  reorder?: { index: number; count: number; busy: boolean; onMove: (direction: "left" | "right") => void };
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { laneStatus: column.laneStatus, stageId: column.stageId },
  });

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
          {column.title} · {column.tasks.length}
        </p>
        {reorder && (
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              disabled={reorder.index === 0 || reorder.busy}
              onClick={() => reorder.onMove("left")}
              aria-label={`Mover ${column.title} para a esquerda`}
              className="flex h-5 w-5 items-center justify-center rounded border border-[#D0D5DD] text-[10px] text-[#344054] disabled:opacity-30"
            >
              ←
            </button>
            <button
              type="button"
              disabled={reorder.index === reorder.count - 1 || reorder.busy}
              onClick={() => reorder.onMove("right")}
              aria-label={`Mover ${column.title} para a direita`}
              className="flex h-5 w-5 items-center justify-center rounded border border-[#D0D5DD] text-[10px] text-[#344054] disabled:opacity-30"
            >
              →
            </button>
          </div>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2 rounded-lg p-1 transition-colors ${
          isOver ? "bg-[#F1EDFE]" : ""
        }`}
      >
        {column.tasks.map((task) => (
          <TaskCard key={task.id} task={task} canDrag={canDragTask(task)} onOpen={onOpen} />
        ))}
        {column.tasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#E4E7EC] px-3 py-4 text-center text-xs text-[#98A2B3]">
            Vazio
          </p>
        )}
      </div>
    </div>
  );
}

function NewStageColumn({ onCreated }: { onCreated: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/operation-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a coluna.");
      return;
    }
    setName("");
    setAdding(false);
    onCreated();
  }

  if (!adding) {
    return (
      <div className="flex min-w-[180px] flex-col">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 items-center justify-center rounded-lg border border-dashed border-[#D0D5DD] px-3 text-xs font-medium text-[#667085] hover:border-[#6847F5] hover:text-[#6847F5]"
        >
          + Nova coluna
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-1.5 rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void create();
          if (e.key === "Escape") setAdding(false);
        }}
        placeholder="Nome da coluna"
        className="h-8 rounded-md border border-[#D0D5DD] px-2 text-xs outline-none focus:border-[#6847F5]"
      />
      {error && <p className="text-[10px] font-medium text-[#D94343]">{error}</p>}
      <div className="flex gap-1">
        <button
          type="button"
          disabled={loading}
          onClick={() => void create()}
          className="flex h-7 flex-1 items-center justify-center rounded-md text-xs font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#6847F5" }}
        >
          Criar
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="flex h-7 flex-1 items-center justify-center rounded-md border border-[#D0D5DD] text-xs font-medium text-[#344054]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function OperationBoard({
  tasks,
  people,
  stages,
  currentUserId,
  canManageAnyTask,
}: {
  tasks: BoardTask[];
  people: PersonOption[];
  stages: StageOption[];
  currentUserId: string;
  canManageAnyTask: boolean;
}) {
  const router = useRouter();
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageBusyId, setStageBusyId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function canDragTask(task: BoardTask): boolean {
    if (canManageAnyTask) return true;
    if (!task.assigneeUserId) return true;
    return task.assigneeUserId === currentUserId;
  }

  const columns = useMemo<Column[]>(() => {
    const unassigned = sortByDueDate(tasks.filter((t) => t.status === "BACKLOG" && !t.assigneeUserId));
    const perPerson = people.map((person) => ({
      id: `person-${person.userId}`,
      title: `A Fazer — ${person.name}`,
      laneStatus: "BACKLOG" as WorkItemStatus,
      stageId: null,
      tasks: sortByDueDate(tasks.filter((t) => t.status === "BACKLOG" && t.assigneeUserId === person.userId)),
    }));
    const stageColumns = stages.map((stage) => ({
      id: `stage-${stage.id}`,
      title: stage.name,
      laneStatus: "EM_ANDAMENTO" as WorkItemStatus,
      stageId: stage.id,
      tasks: sortByDueDate(tasks.filter((t) => t.status === "EM_ANDAMENTO" && t.stageId === stage.id)),
    }));
    const done = [...tasks.filter((t) => t.status === "CONCLUIDA")].sort((a, b) => {
      const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bt - at;
    });

    const result: Column[] = [];
    if (unassigned.length > 0) {
      result.push({ id: "unassigned", title: "Não atribuída", laneStatus: "BACKLOG", stageId: null, tasks: unassigned });
    }
    result.push(...perPerson);
    result.push(...stageColumns);
    result.push({ id: "done", title: "Concluído", laneStatus: "CONCLUIDA", stageId: null, tasks: done });
    return result;
  }, [tasks, people, stages]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    const laneStatus = over.data.current?.laneStatus as WorkItemStatus | undefined;
    const stageId = (over.data.current?.stageId as string | undefined) ?? null;
    if (!task || !laneStatus) return;
    const noChange = laneStatus === task.status && (laneStatus !== "EM_ANDAMENTO" || stageId === task.stageId);
    if (noChange) return;
    if (!canDragTask(task)) return;

    setError(null);
    const response = await fetch(`/api/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toLane: laneStatus, stageId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover a tarefa.");
      return;
    }
    router.refresh();
  }

  async function moveStage(stageId: string, direction: "left" | "right") {
    setError(null);
    setStageBusyId(stageId);
    const response = await fetch(`/api/operation-stages/${stageId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    setStageBusyId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover a coluna.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
        <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-2">
          {columns.map((column) => {
            const stageIndex = column.stageId ? stages.findIndex((s) => s.id === column.stageId) : -1;
            return (
              <BoardColumn
                key={column.id}
                column={column}
                canDragTask={canDragTask}
                onOpen={setOpenTask}
                reorder={
                  stageIndex >= 0
                    ? {
                        index: stageIndex,
                        count: stages.length,
                        busy: stageBusyId === column.stageId,
                        onMove: (direction) => void moveStage(column.stageId!, direction),
                      }
                    : undefined
                }
              />
            );
          })}
          <NewStageColumn onCreated={() => router.refresh()} />
        </div>
      </DndContext>
      {openTask && (
        <TaskDetailModal
          task={openTask}
          currentUserId={currentUserId}
          canManageAnyTask={canManageAnyTask}
          onClose={() => setOpenTask(null)}
          onChanged={() => {
            setOpenTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
