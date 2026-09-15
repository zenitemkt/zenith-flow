"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface TaskOption {
  id: string;
  title: string;
}

export function TimerWidget({ tasks }: { tasks: TaskOption[] }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [stoppedMinutes, setStoppedMinutes] = useState<number | null>(null);
  const [taskId, setTaskId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function start() {
    setSeconds(0);
    setStoppedMinutes(null);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    setStoppedMinutes(Math.max(1, Math.round(seconds / 60)));
  }

  function discard() {
    setStoppedMinutes(null);
    setSeconds(0);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stoppedMinutes) return;
    setError(null);
    setLoading(true);

    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        minutes: stoppedMinutes,
        taskId: taskId || null,
        description,
        source: "TIMER",
      }),
    });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar o apontamento do cronômetro.");
      return;
    }

    setStoppedMinutes(null);
    setSeconds(0);
    setTaskId("");
    setDescription("");
    router.refresh();
  }

  function formatClock(total: number) {
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  if (stoppedMinutes !== null) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-[#EEF0F3] bg-[#F9FAFB] p-3">
        <p className="text-sm font-medium text-[#101828]">
          Cronômetro parado: {stoppedMinutes} minuto{stoppedMinutes === 1 ? "" : "s"}
        </p>
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#FF2B00]"
        >
          <option value="">Sem tarefa vinculada</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que você fez? (opcional)"
          className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#FF2B00]"
        />
        {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={discard}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "#FF2B00" }}
          >
            {loading ? "Salvando..." : "Apontar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-[#EEF0F3] bg-[#F9FAFB] p-3">
      <p className="font-mono text-lg font-semibold text-[#101828]">{formatClock(seconds)}</p>
      {running ? (
        <button
          type="button"
          onClick={stop}
          className="flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
          style={{ backgroundColor: "#D94343" }}
        >
          Parar
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
          style={{ backgroundColor: "#16A36A" }}
        >
          Iniciar
        </button>
      )}
    </div>
  );
}
