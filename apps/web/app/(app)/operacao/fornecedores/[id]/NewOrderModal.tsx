"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";

interface TaskOption {
  id: string;
  title: string;
  clientName: string;
}

export function NewOrderModal({ vendorId, tasks }: { vendorId: string; tasks: TaskOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setDescription("");
    setTaskId("");
    setError(null);
    setOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch(`/api/vendors/${vendorId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, taskId: taskId || null }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a ordem.");
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
        Nova ordem
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Nova ordem ao fornecedor"
        description="Pode vincular a uma tarefa interna, se for o caso."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="order-description" className="text-sm font-medium text-[#344054]">
              O que está sendo pedido
            </label>
            <textarea
              id="order-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>
          {tasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="order-task" className="text-sm font-medium text-[#344054]">
                Tarefa relacionada (opcional)
              </label>
              <select
                id="order-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
              >
                <option value="">Nenhuma</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.clientName})
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
              {loading ? "Criando..." : "Criar ordem"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
