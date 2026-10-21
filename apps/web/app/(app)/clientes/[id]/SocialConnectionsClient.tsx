"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Instagram } from "lucide-react";

interface PageOption {
  id: string;
  name: string;
  pictureUrl: string | null;
  instagram: { username: string | null; pictureUrl: string | null } | null;
}

/** Depois do login na Meta: escolher qual Página (e o Instagram dela) é deste cliente. */
export function SocialPagePicker({ clientId, pages }: { clientId: string; pages: PageOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = pages.filter((p) =>
    `${p.name} ${p.instagram?.username ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function choose(pageId: string) {
    if (saving) return;
    setSaving(pageId);
    setError(null);
    const res = await fetch("/api/social/meta/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, pageId }),
    });
    setSaving(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Não foi possível conectar.");
      return;
    }
    router.replace(`/clientes/${clientId}#redes`);
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-xl border border-[#FF2B00]/30 bg-[#FFF9F7] p-3">
      <p className="text-sm font-semibold text-[#101828]">Qual Página é deste cliente?</p>
      <p className="mb-2 text-xs text-[#667085]">O Instagram profissional vinculado à Página é conectado junto.</p>
      {pages.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar Página ou @instagram..."
          aria-label="Buscar Página"
          className="mb-2 h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm outline-none focus:border-[#FF2B00]"
        />
      )}
      {pages.length === 0 && (
        <p className="text-sm text-[#B42318]">
          Nenhuma Página encontrada. Na tela da Meta, marque as Páginas do cliente ao autorizar.
        </p>
      )}
      <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {visible.map((page) => (
          <li key={page.id}>
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void choose(page.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-left hover:border-[#FF2B00] disabled:opacity-60"
            >
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#F2F4F7]">
                {page.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.pictureUrl} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[#101828]">{page.name}</span>
                <span className="flex items-center gap-1 truncate text-xs text-[#667085]">
                  <Instagram size={12} aria-hidden />
                  {page.instagram ? `@${page.instagram.username ?? "conta vinculada"}` : "sem Instagram profissional"}
                </span>
              </span>
              {saving === page.id ? <span className="text-xs text-[#667085]">Conectando...</span> : <Check size={16} className="text-[#98A2B3]" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}

export function DisconnectSocialButton({ connectionId, label }: { connectionId: string; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    if (!window.confirm(`Desconectar ${label}? Agendamentos pendentes nesta conta serão cancelados.`)) return;
    setLoading(true);
    await fetch(`/api/social/connections/${connectionId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void disconnect()}
      disabled={loading}
      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-[#667085] hover:bg-[#F2F4F7] hover:text-[#B42318] disabled:opacity-60"
    >
      {loading ? "..." : "Desconectar"}
    </button>
  );
}

export function SocialSettingsForm({
  clientId,
  autoScheduleOnApproval,
  defaultPublishTime,
}: {
  clientId: string;
  autoScheduleOnApproval: boolean;
  defaultPublishTime: string;
}) {
  const router = useRouter();
  const [auto, setAuto] = useState(autoScheduleOnApproval);
  const [time, setTime] = useState(defaultPublishTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: { autoScheduleOnApproval?: boolean; defaultPublishTime?: string }) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/social-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Não foi possível salvar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-[#EEF0F3] pt-3">
      <label className="flex items-start gap-2.5 text-sm text-[#344054]">
        <input
          type="checkbox"
          checked={auto}
          disabled={saving}
          onChange={(e) => {
            setAuto(e.target.checked);
            void save({ autoScheduleOnApproval: e.target.checked });
          }}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium text-[#101828]">Agendar sozinho quando o cliente aprovar</span>
          <span className="block text-xs text-[#667085]">
            A peça aprovada com data de publicação e arte anexada é agendada na rede do canal dela, no horário padrão abaixo.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-[#344054]">
        Horário padrão de publicação
        <input
          type="time"
          value={time}
          disabled={saving}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => time !== defaultPublishTime && void save({ defaultPublishTime: time })}
          className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#FF2B00]"
        />
      </label>
      {error && <p className="text-xs font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
