"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@zenith/ui";
import { FormField } from "@/app/_components/FormField";
import { WEEKDAY_LABELS, MONTH_LABELS, buildMonthCells } from "@/lib/content-calendar";
import type { BoardTask, PersonOption } from "./OperationBoard";

interface ClientOption {
  id: string;
  name: string;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function NewTaskModal({
  clients,
  people,
  allTasks,
}: {
  clients: ClientOption[];
  people: PersonOption[];
  allTasks: BoardTask[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [estimatedUnit, setEstimatedUnit] = useState<"horas" | "minutos">("horas");
  const [checklistEnabled, setChecklistEnabled] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [blockedByTaskId, setBlockedByTaskId] = useState("");
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<"MENSAL" | "DATAS_ESPECIFICAS">("MENSAL");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const blockableTasks = useMemo(
    () =>
      allTasks.filter(
        (t) => t.clientId === (clientId || null) && t.status !== "CONCLUIDA" && t.status !== "CANCELADA",
      ),
    [allTasks, clientId],
  );

  function close() {
    setTitle("");
    setDescription("");
    setClientId("");
    setDueDate("");
    setEstimatedValue("");
    setChecklistEnabled(false);
    setChecklistItems([""]);
    setSelectedAssignees([]);
    setBlockedByTaskId("");
    setRecurringEnabled(false);
    setRecurrenceMode("MENSAL");
    setDayOfMonth("1");
    setSelectedDates(new Set());
    setError(null);
    setOpen(false);
  }

  function toggleAssignee(userId: string) {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function toggleDate(dateKey: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  function updateChecklistItem(index: number, value: string) {
    setChecklistItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (selectedAssignees.length === 0) {
      setError("Escolha ao menos um responsável.");
      return;
    }

    const estimatedMinutes = estimatedValue.trim()
      ? Math.round(Number(estimatedValue) * (estimatedUnit === "horas" ? 60 : 1))
      : null;
    const checklist = checklistEnabled ? checklistItems.map((t) => t.trim()).filter(Boolean) : [];

    setLoading(true);

    let response: Response;
    if (recurringEnabled) {
      response = await fetch("/api/recurring-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          clientId: clientId || null,
          estimatedMinutes,
          checklist,
          assigneeUserIds: selectedAssignees,
          recurrenceMode,
          dayOfMonth: recurrenceMode === "MENSAL" ? Number(dayOfMonth) : undefined,
          dates: recurrenceMode === "DATAS_ESPECIFICAS" ? Array.from(selectedDates) : undefined,
        }),
      });
    } else {
      response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          clientId: clientId || null,
          dueDate: dueDate || null,
          estimatedMinutes,
          checklist,
          assigneeUserIds: selectedAssignees,
          blockedByTaskId: blockedByTaskId || null,
        }),
      });
    }

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível criar a tarefa.");
      return;
    }

    close();
    router.refresh();
  }

  const { cells } = buildMonthCells(calendarYear, calendarMonth);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white"
        style={{ backgroundColor: "#6847F5" }}
      >
        + Novo Card
      </button>
      <Modal open={open} onClose={close} title="Novo Card">
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <FormField label="Título" name="title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-description" className="text-sm font-medium text-[#344054]">
              Descrição
            </label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#6847F5] focus:ring-2 focus:ring-[#EDE9FE]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-client" className="text-sm font-medium text-[#344054]">
              Marca
            </label>
            <select
              id="task-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setBlockedByTaskId("");
              }}
              className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
            >
              <option value="">Interna (sem cliente)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {!recurringEnabled && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-due" className="text-sm font-medium text-[#344054]">
                  Prazo
                </label>
                <input
                  id="task-due"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="task-estimate" className="text-sm font-medium text-[#344054]">
                  Duração estimada
                </label>
                <div className="flex gap-1">
                  <input
                    id="task-estimate"
                    type="number"
                    min={0}
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
                  />
                  <select
                    value={estimatedUnit}
                    onChange={(e) => setEstimatedUnit(e.target.value as "horas" | "minutos")}
                    className="h-11 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#6847F5]"
                  >
                    <option value="horas">horas</option>
                    <option value="minutos">min</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-[#344054]">
              Checklist
              <input
                type="checkbox"
                checked={checklistEnabled}
                onChange={(e) => setChecklistEnabled(e.target.checked)}
              />
            </label>
            {checklistEnabled && (
              <div className="mt-2 flex flex-col gap-1.5">
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-1">
                    <input
                      value={item}
                      onChange={(e) => updateChecklistItem(index, e.target.value)}
                      placeholder={`Item ${index + 1}`}
                      className="h-9 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
                    />
                    <button
                      type="button"
                      onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== index))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-sm text-[#344054]"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setChecklistItems((prev) => [...prev, ""])}
                  className="self-start text-xs font-medium text-[#6847F5] hover:underline"
                >
                  + Adicionar item
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-[#344054]">
              Responsáveis <span className="text-[#D94343]">*</span>
            </p>
            <p className="mb-1.5 text-xs text-[#98A2B3]">
              O card nasce direto na coluna do 1º responsável — clique na ordem em que a fila deve seguir.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {people.map((person) => {
                const position = selectedAssignees.indexOf(person.userId);
                return (
                  <button
                    key={person.userId}
                    type="button"
                    onClick={() => toggleAssignee(person.userId)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      position >= 0
                        ? "bg-[#6847F5] text-white"
                        : "border border-[#E4E7EC] text-[#475467] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {position >= 0 ? `${position + 1}. ` : ""}
                    {person.name}
                  </button>
                );
              })}
            </div>
          </div>

          {blockableTasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-blocker" className="text-sm font-medium text-[#344054]">
                Bloqueada por (opcional)
              </label>
              <select
                id="task-blocker"
                value={blockedByTaskId}
                onChange={(e) => setBlockedByTaskId(e.target.value)}
                className="h-11 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
              >
                <option value="">Nenhuma</option>
                {blockableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="flex items-center justify-between text-sm font-medium text-[#344054]">
              Tarefa Recorrente
              <input
                type="checkbox"
                checked={recurringEnabled}
                onChange={(e) => setRecurringEnabled(e.target.checked)}
              />
            </label>
            {recurringEnabled && (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#E4E7EC] p-3">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setRecurrenceMode("MENSAL")}
                    className={`h-8 flex-1 rounded-md text-xs font-medium ${
                      recurrenceMode === "MENSAL" ? "bg-[#6847F5] text-white" : "border border-[#D0D5DD] text-[#344054]"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceMode("DATAS_ESPECIFICAS")}
                    className={`h-8 flex-1 rounded-md text-xs font-medium ${
                      recurrenceMode === "DATAS_ESPECIFICAS"
                        ? "bg-[#6847F5] text-white"
                        : "border border-[#D0D5DD] text-[#344054]"
                    }`}
                  >
                    Datas específicas
                  </button>
                </div>

                {recurrenceMode === "MENSAL" ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="task-day-of-month" className="text-xs font-medium text-[#344054]">
                      Todo dia do mês:
                    </label>
                    <input
                      id="task-day-of-month"
                      type="number"
                      min={1}
                      max={28}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      className="h-9 w-24 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#6847F5]"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth((m) => {
                            if (m === 0) {
                              setCalendarYear((y) => y - 1);
                              return 11;
                            }
                            return m - 1;
                          })
                        }
                        className="text-xs text-[#6847F5]"
                      >
                        ←
                      </button>
                      <span className="text-xs font-medium text-[#344054]">
                        {MONTH_LABELS[calendarMonth]} de {calendarYear}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarMonth((m) => {
                            if (m === 11) {
                              setCalendarYear((y) => y + 1);
                              return 0;
                            }
                            return m + 1;
                          })
                        }
                        className="text-xs text-[#6847F5]"
                      >
                        →
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#98A2B3]">
                      {WEEKDAY_LABELS.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {cells.map((day, index) => {
                        if (!day) return <span key={index} />;
                        const key = isoDate(calendarYear, calendarMonth, day);
                        const selected = selectedDates.has(key);
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => toggleDate(key)}
                            className={`h-7 rounded-md text-xs ${
                              selected ? "bg-[#6847F5] text-white" : "hover:bg-[#F1EDFE] text-[#344054]"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDates.size > 0 && (
                      <p className="mt-1 text-[10px] text-[#98A2B3]">{selectedDates.size} data(s) selecionada(s)</p>
                    )}
                  </div>
                )}
              </div>
            )}
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
              {loading ? "Criando..." : "Criar card"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
