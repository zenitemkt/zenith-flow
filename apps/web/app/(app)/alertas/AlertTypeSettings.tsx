"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AlertType {
  id: string;
  category: string;
  label: string;
  description: string;
}

const GROUP_LABEL: Record<string, string> = {
  COMMERCIAL: "Comercial",
  SITE: "Site",
  TRACKING: "Traqueamento",
  BLOG: "Blog",
  SOCIAL: "Redes sociais",
  AUTOMATION: "Automações",
  INTEGRATION: "Integrações",
};

/** Liga/desliga cada tipo de alerta. Desligado: não cria alerta novo e some do sino e da lista. */
export function AlertTypeSettings({ types, initialDisabled }: { types: AlertType[]; initialDisabled: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState<Set<string>>(new Set(initialDisabled));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle(id: string) {
    const next = new Set(disabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDisabled(next);
    setSaving(true);
    setError("");
    const response = await fetch("/api/system-alerts/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disabledTypes: Array.from(next) }) });
    setSaving(false);
    if (!response.ok) {
      setDisabled(disabled);
      setError("Não consegui salvar. Tente de novo.");
      return;
    }
    router.refresh();
  }

  const groups = Array.from(new Set(types.map((t) => t.category)));

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span>
          <span className="block text-sm font-semibold text-[#101828]">Tipos de alerta</span>
          <span className="text-xs text-[#667085]">
            {disabled.size ? `${types.length - disabled.size} ligados, ${disabled.size} desligado(s)` : "Todos ligados"}
            {saving ? " · salvando…" : ""}
          </span>
        </span>
        <span className="text-xs font-medium text-[#FF2B00]">{open ? "Recolher" : "Configurar"}</span>
      </button>
      {open && (
        <div className="border-t border-[#EEF0F3] px-4 py-3">
          <p className="mb-3 text-xs text-[#667085]">Tipo desligado não gera alerta novo e some do sino e desta lista. Ao religar, os alertas voltam a aparecer.</p>
          {error && <p className="mb-2 text-xs text-[#B42318]">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">{GROUP_LABEL[g] ?? g}</p>
                <ul className="space-y-1.5">
                  {types
                    .filter((t) => t.category === g)
                    .map((t) => {
                      const on = !disabled.has(t.id);
                      return (
                        <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#EEF0F3] px-3 py-2">
                          <span>
                            <span className="block text-sm font-medium text-[#101828]">{t.label}</span>
                            <span className="text-xs text-[#667085]">{t.description}</span>
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`${on ? "Desligar" : "Ligar"} ${t.label}`}
                            disabled={saving}
                            onClick={() => toggle(t.id)}
                            className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-[#12B76A]" : "bg-[#D0D5DD]"} disabled:opacity-60`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
