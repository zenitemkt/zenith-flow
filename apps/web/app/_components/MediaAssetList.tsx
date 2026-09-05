"use client";

import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/media";

export interface MediaAssetRow {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  clientName?: string | null;
}

export function MediaAssetList({
  assets,
  showClient,
  readOnly,
}: {
  assets: MediaAssetRow[];
  showClient?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const response = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (response.ok) router.refresh();
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-6 text-center">
        <p className="text-sm text-[#667085]">Nenhum arquivo ainda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="flex items-center justify-between rounded-lg border border-[#EEF0F3] px-3 py-2"
        >
          <a
            href={`/api/media/${asset.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[#6847F5] hover:underline"
          >
            {asset.fileName}
          </a>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#98A2B3]">
              {showClient && asset.clientName ? `${asset.clientName} · ` : ""}
              {formatBytes(asset.sizeBytes)} · {new Date(asset.createdAt).toLocaleDateString("pt-BR")}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => void handleDelete(asset.id)}
                className="text-xs font-medium text-[#D94343] hover:underline"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
