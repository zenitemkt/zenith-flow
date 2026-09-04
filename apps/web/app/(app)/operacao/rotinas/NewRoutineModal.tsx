"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { Plus, X } from "lucide-react";
import { FormField } from "@/app/_components/FormField";

interface ClientOption {
  id: string;
  name: string;
}

export function NewRoutineModal({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [taskTitles, setTaskTitles] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function close() {
    setName("");
    setClientId("");
    setDayOfMonth("1");
    setTaskTitles(["", "", ""]);
    setError(null);
    setOpen(false);
  }

  function updateTask(index: number, value: string) {
    setTaskTitles((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        clientId: clientId || null,
        dayOfMonth: Number(dayOfMonth),
        taskTitles: taskTitles.filter((t) => t.trim()),
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a rotina.");
      return;
    }

    const body = await response.json();
    close();
    router.push(`/operacao/rotinas/${body.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        Nova rotina
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Nova rotina recorrente"
        description="Todo mês, no dia escolhido, um projeto novo com estas tarefas é criado automaticamente."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Nome da rotina"
            name="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rotina mensal de conteúdo"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="routine-client" className="text-sm font-medium text-[#344054]">
                Cliente (opcional)
              </label>
              <select
                id="routine-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
              >
                <option value="">Interna</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="Dia do mês"
              name="dayOfMonth"
              type="number"
              min={1}
              max={28}
              required
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#344054]">Tarefas geradas todo mês</label>
            {taskTitles.map((title, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={title}
                  onChange={(e) => updateTask(index, e.target.value)}
                  placeholder={`Tarefa ${index + 1}`}
                  className="h-10 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
                />
                {taskTitles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTaskTitles((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remover tarefa"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#98A2B3] hover:bg-[#F6F7FB]"
                  >
                    <X size={14} aria-hidden />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTaskTitles((prev) => [...prev, ""])}
              className="mt-1 flex items-center gap-1 self-start text-xs font-medium text-[#6847F5] hover:underline"
            >
              <Plus size={12} aria-hidden />
              Adicionar tarefa
            </button>
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
              style={{ backgroundColor: "#6847F5" }}
            >
              {loading ? "Criando..." : "Criar rotina"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
