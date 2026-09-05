"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/app/_components/FormField";

interface TaskOption {
  id: string;
  title: string;
}

export function NewTimeEntryForm({ tasks, defaultDate }: { tasks: TaskOption[]; defaultDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [taskId, setTaskId] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        minutes: Number(minutes),
        taskId: taskId || null,
        description,
        source: "MANUAL",
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível apontar as horas.");
      return;
    }

    setMinutes("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Data" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <FormField
          label="Minutos"
          name="minutes"
          type="number"
          min={1}
          required
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="60"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="entry-task" className="text-sm font-medium text-[#344054]">
          Tarefa (opcional)
        </label>
        <select
          id="entry-task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
        >
          <option value="">Sem tarefa vinculada</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </div>
      <FormField
        label="Descrição (opcional)"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-end flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ backgroundColor: "#6847F5" }}
      >
        {loading ? "Salvando..." : "Apontar"}
      </button>
    </form>
  );
}
