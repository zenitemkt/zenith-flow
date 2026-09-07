"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AttachBoletoButton({
  entryId,
  clientId,
  boleto,
}: {
  entryId: string;
  clientId: string | null;
  boleto: { id: string; fileName: string } | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file || !clientId) return;
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    const uploadResponse = await fetch("/api/media", { method: "POST", body: formData });
    const uploadBody = await uploadResponse.json().catch(() => null);
    if (!uploadResponse.ok) {
      setLoading(false);
      setError(uploadBody?.error ?? "Não foi possível enviar o arquivo.");
      return;
    }

    const linkResponse = await fetch(`/api/finance/entries/${entryId}/boleto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaAssetId: uploadBody.id }),
    });
    setLoading(false);
    if (!linkResponse.ok) {
      const body = await linkResponse.json().catch(() => null);
      setError(body?.error ?? "Não foi possível vincular o boleto.");
      return;
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function handleRemove() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/finance/entries/${entryId}/boleto`, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível remover o boleto.");
      return;
    }
    router.refresh();
  }

  if (boleto) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5">
          <a
            href={`/api/media/${boleto.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[140px] truncate text-xs font-medium text-[#6847F5] hover:underline"
            title={boleto.fileName}
          >
            {boleto.fileName}
          </a>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleRemove()}
            className="text-xs font-medium text-[#D94343] hover:underline disabled:opacity-60"
          >
            Remover
          </button>
        </div>
        {error && <p className="text-[10px] font-medium text-[#D94343]">{error}</p>}
      </div>
    );
  }

  if (!clientId) {
    return <span className="text-xs text-[#98A2B3]">Sem cliente vinculado</span>;
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={() => void handleUpload()}
          disabled={loading}
          className="w-[130px] text-xs text-[#475467] file:mr-1.5 file:rounded-md file:border-0 file:bg-[#F1EDFE] file:px-2 file:py-1 file:text-xs file:font-medium file:text-[#6847F5]"
        />
      </div>
      {error && <p className="text-[10px] font-medium text-[#D94343]">{error}</p>}
    </div>
  );
}
