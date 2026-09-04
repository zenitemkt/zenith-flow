"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";

interface TaskOption {
  id: string;
  title: string;
}

interface PersonOption {
  userId: string;
  name: string;
}

export function NewTaskModal({
  projectId,
  existingTasks,
  people,
}: {
  projectId: string;
  existingTasks: TaskOption[];
  people: PersonOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [blockedByTaskId, setBlockedByTaskId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setTitle("");
    setDescription("");
    setBlockedByTaskId("");
    setAssigneeUserId("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description,
        blockedByTaskId: blockedByTaskId || null,
        assigneeUserId: assigneeUserId || null,
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a tarefa.");
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
        className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Nova tarefa
      </button>
      <Modal open={open} onClose={close} title="Nova tarefa">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Título"
            name="task-title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-description" className="text-sm font-medium text-[#344054]">
              Descrição
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-assignee" className="text-sm font-medium text-[#344054]">
              Responsável (opcional)
            </label>
            <select
              id="task-assignee"
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            >
              <option value="">Sem responsável</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          {existingTasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-blocker" className="text-sm font-medium text-[#344054]">
                Bloqueada por (opcional)
              </label>
              <select
                id="task-blocker"
                value={blockedByTaskId}
                onChange={(e) => setBlockedByTaskId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
              >
                <option value="">Nenhuma</option>
                {existingTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Criando..." : "Criar tarefa"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
