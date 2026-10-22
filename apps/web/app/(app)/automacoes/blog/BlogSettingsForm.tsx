"use client";

import { useState } from "react";

interface Props {
  initialAutoPublish: boolean;
  initialVoiceNotes: string;
}

/** Item 5 (publicação automática por agência) e item 4 (tom de voz por agência) do Blueprint, seção 5. */
export function BlogSettingsForm({ initialAutoPublish, initialVoiceNotes }: Props) {
  const [autoPublish, setAutoPublish] = useState(initialAutoPublish);
  const [voiceNotes, setVoiceNotes] = useState(initialVoiceNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const response = await fetch("/api/admin/blog-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoPublish, voiceNotes }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    setSaved(true);
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-[#101828]">Configurações de publicação</h2>

      <label className="mb-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={autoPublish}
          onChange={(event) => setAutoPublish(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[#D0D5DD]"
        />
        <span>
          <span className="block text-sm font-medium text-[#344054]">Publicar automaticamente, sem aprovação manual</span>
          <span className="block text-xs text-[#667085]">
            Ativo: o agente aprova e publica sozinho todo dia útil. Desativado: todo rascunho fica pendente aqui até você aprovar.
          </span>
        </span>
      </label>

      <label className="mb-3 block text-xs font-medium text-[#475467]">
        Tom de voz específico desta agência (opcional)
        <textarea
          value={voiceNotes}
          onChange={(event) => setVoiceNotes(event.target.value)}
          placeholder="Ex.: gírias ou expressões próprias, grau de formalidade, exemplos a evitar..."
          rows={4}
          className="mt-1 w-full rounded-lg border border-[#D0D5DD] p-2.5 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
        />
      </label>
      <p className="mb-3 text-xs text-[#98A2B3]">Anexado ao final das regras de escrita que o agente busca antes de cada artigo.</p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        {saved && <span className="text-xs font-medium text-[#027A48]">Salvo.</span>}
        {error && <span className="text-xs font-medium text-[#B42318]">{error}</span>}
      </div>
    </section>
  );
}
