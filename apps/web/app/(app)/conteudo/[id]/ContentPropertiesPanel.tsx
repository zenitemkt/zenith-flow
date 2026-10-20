"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Users } from "lucide-react";

interface Person {
  userId: string;
  name: string;
}

/**
 * Campos que mudam no dia a dia (data de publicação e responsáveis) editáveis
 * direto no painel, sem abrir outro popup — mesmas rotas que o quadro já usa.
 */
export function ContentPropertiesPanel({
  contentId,
  scheduledDateISO,
  assigneeUserIds,
  people,
}: {
  contentId: string;
  scheduledDateISO: string | null;
  assigneeUserIds: string[];
  people: Person[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(scheduledDateISO ? scheduledDateISO.slice(0, 10) : "");
  const [assignees, setAssignees] = useState<string[]>(assigneeUserIds);
  const [saving, setSaving] = useState<"date" | "assignees" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveDate(next: string) {
    setDate(next);
    setSaving("date");
    setError(null);
    const res = await fetch(`/api/content/${contentId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: next }),
    });
    setSaving(null);
    if (!res.ok) {
      setError("Não foi possível salvar a data.");
      return;
    }
    router.refresh();
  }

  async function toggleAssignee(userId: string) {
    const previous = assignees;
    const next = previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId];
    setAssignees(next);
    setSaving("assignees");
    setError(null);
    const res = await fetch(`/api/content/${contentId}/assignees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeUserIds: next }),
    });
    setSaving(null);
    if (!res.ok) {
      setAssignees(previous);
      setError("Não foi possível mudar o responsável.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#667085]">
          <CalendarDays size={13} aria-hidden /> Publicação
          {saving === "date" && <span className="text-[#98A2B3]">· salvando...</span>}
        </span>
        <input
          type="date"
          value={date}
          disabled={saving === "date"}
          onChange={(e) => void saveDate(e.target.value)}
          aria-label="Data de publicação"
          className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
        />
      </div>

      {people.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#667085]">
            <Users size={13} aria-hidden /> Responsáveis
            {saving === "assignees" && <span className="text-[#98A2B3]">· salvando...</span>}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {people.map((person) => {
              const active = assignees.includes(person.userId);
              return (
                <button
                  key={person.userId}
                  type="button"
                  aria-pressed={active}
                  disabled={saving === "assignees"}
                  onClick={() => void toggleAssignee(person.userId)}
                  className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-60 ${
                    active
                      ? "bg-[#101828] text-white"
                      : "border border-[#E4E7EC] bg-white text-[#475467] hover:bg-[#F9FAFB]"
                  }`}
                >
                  {active && <Check size={12} aria-hidden />}
                  {person.name}
                </button>
              );
            })}
          </div>
          {assignees.length === 0 && <p className="text-xs text-[#98A2B3]">Sem responsável — fica na coluna &quot;Backend&quot;.</p>}
        </div>
      )}

      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </>
  );
}
