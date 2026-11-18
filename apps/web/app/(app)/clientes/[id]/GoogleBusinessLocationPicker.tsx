"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/lib/dialogs";

interface Option {
  accountId: string;
  locationId: string;
  name: string;
  address: string | null;
}

/** Escolhe qual unidade do Google Meu Negócio (conta já conectada pela agência) pertence a este cliente. */
export function GoogleBusinessLocationPicker({ clientId, linked }: { clientId: string; linked: { name: string } | null }) {
  const router = useRouter();
  const [options, setOptions] = useState<Option[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPicker() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/google-business`);
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Não foi possível listar as localizações.");
      return;
    }
    setOptions(body.options ?? []);
  }

  async function pick(option: Option) {
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/google-business`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(option),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Não foi possível vincular.");
      return;
    }
    setOptions(null);
    router.refresh();
  }

  async function unlink() {
    if (!(await confirmDialog("Desvincular esta localização do cliente? O histórico de avaliações continua guardado.", { title: "Desvincular", confirmLabel: "Desvincular", danger: true }))) return;
    setBusy(true);
    await fetch(`/api/clients/${clientId}/google-business`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (linked) {
    return (
      <button type="button" disabled={busy} onClick={() => void unlink()} className="text-xs font-medium text-[#667085] hover:text-[#B42318] disabled:opacity-60">
        Desvincular
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={() => void openPicker()} className="text-xs font-semibold text-[#FF2B00] hover:underline disabled:opacity-60">
        {busy ? "Buscando..." : "Vincular localização"}
      </button>
      {error && <p className="text-right text-[11px] text-[#B42318]">{error}</p>}
      {options && (
        <div className="mt-1 max-h-60 w-72 overflow-y-auto rounded-lg border border-[#E4E7EC] bg-white p-1 shadow-lg">
          {options.length === 0 && <p className="p-2 text-xs text-[#98A2B3]">Nenhuma localização livre. Todas já estão vinculadas a outros clientes.</p>}
          {options.map((o) => (
            <button key={o.locationId} type="button" disabled={busy} onClick={() => void pick(o)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#F9FAFB] disabled:opacity-60">
              <span className="block font-medium text-[#101828]">{o.name}</span>
              {o.address && <span className="block text-[#98A2B3]">{o.address}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
