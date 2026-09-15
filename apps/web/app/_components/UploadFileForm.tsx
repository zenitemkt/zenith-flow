"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface ClientOption {
  id: string;
  name: string;
}

export function UploadFileForm({
  clientId,
  clientOptions,
}: {
  /** Cliente fixo (ex.: dentro do perfil de um cliente específico). */
  clientId?: string;
  /** Quando não há cliente fixo, mostra um seletor com essas opções. */
  clientOptions?: ClientOption[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    const finalClientId = clientId || selectedClientId;
    if (finalClientId) formData.append("clientId", finalClientId);

    const response = await fetch("/api/media", { method: "POST", body: formData });

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível enviar o arquivo.");
      return;
    }

    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {!clientId && clientOptions && clientOptions.length > 0 && (
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="h-9 rounded-lg border border-[#D0D5DD] px-2 text-sm outline-none focus:border-[#FF2B00]"
        >
          <option value="">Sem cliente vinculado</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          required
          className="flex-1 text-sm text-[#475467] file:mr-3 file:rounded-lg file:border-0 file:bg-[#FFF1EC] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#FF2B00]"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "#FF2B00" }}
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>
      <p className="text-xs text-[#98A2B3]">Até 25MB.</p>
      {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
    </form>
  );
}
