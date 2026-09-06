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

export interface BoardTask {
  id: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
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

function TaskCard({ task, onOpen }: { task: BoardTask; onOpen: (task: BoardTask) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;
  const blocked = task.blockedBy && task.blockedBy.status !== "CONCLUIDA";
  const overdue = task.dueDate && !task.completedAt && new Date(task.dueDate).getTime() < Date.now();
  const doneCount = task.checklistItems.filter((c) => c.done).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isDragging) onOpen(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task);
      }}
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
  onOpen,
}: {
  column: Column;
  onOpen: (task: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { laneStatus: column.laneStatus } });

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">
        {column.title} · {column.tasks.length}
      </p>
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2 rounded-lg p-1 transition-colors ${
          isOver ? "bg-[#F1EDFE]" : ""
        }`}
      >
        {column.tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpen={onOpen} />
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

export function OperationBoard({
  tasks,
  people,
  currentUserId,
}: {
  tasks: BoardTask[];
  people: PersonOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo<Column[]>(() => {
    const unassigned = sortByDueDate(
      tasks.filter((t) => t.status === "BACKLOG" && !t.assigneeUserId),
    );
    const perPerson = people.map((person) => ({
      id: `person-${person.userId}`,
      title: `A Fazer — ${person.name}`,
      laneStatus: "BACKLOG" as WorkItemStatus,
      tasks: sortByDueDate(
        tasks.filter((t) => t.status === "BACKLOG" && t.assigneeUserId === person.userId),
      ),
    }));
    const doing = sortByDueDate(tasks.filter((t) => t.status === "EM_ANDAMENTO"));
    const done = [...tasks.filter((t) => t.status === "CONCLUIDA")].sort((a, b) => {
      const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bt - at;
    });

    const result: Column[] = [];
    if (unassigned.length > 0) {
      result.push({ id: "unassigned", title: "Não atribuída", laneStatus: "BACKLOG", tasks: unassigned });
    }
    result.push(...perPerson);
    result.push({ id: "doing", title: "Fazendo", laneStatus: "EM_ANDAMENTO", tasks: doing });
    result.push({ id: "done", title: "Concluído", laneStatus: "CONCLUIDA", tasks: done });
    return result;
  }, [tasks, people]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    const laneStatus = over.data.current?.laneStatus as WorkItemStatus | undefined;
    if (!task || !laneStatus || laneStatus === task.status) return;

    setError(null);
    const response = await fetch(`/api/tasks/${taskId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toLane: laneStatus }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível mover a tarefa.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-lg bg-[#FEE4E2] px-3 py-2 text-sm font-medium text-[#B42318]">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
        <div className="grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <BoardColumn key={column.id} column={column} onOpen={setOpenTask} />
          ))}
        </div>
      </DndContext>
      {openTask && (
        <TaskDetailModal
          task={openTask}
          currentUserId={currentUserId}
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
