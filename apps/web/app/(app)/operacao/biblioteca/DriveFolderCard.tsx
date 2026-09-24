"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FolderOpen, FolderPlus, Pencil } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";

export function DriveFolderCard({
  clientId,
  clientName,
  driveUrl,
}: {
  clientId: string;
  clientName: string;
  driveUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(driveUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function openModal() {
    setValue(driveUrl ?? "");
    setError(null);
    setOpen(true);
  }

  async function save(nextUrl: string | null) {
    await guardSubmit(async () => {
      setError(null);
      setLoading(true);
      const response = await fetch(`/api/clients/${clientId}/drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl: nextUrl }),
      });
      const body = await response.json().catch(() => null);
      setLoading(false);
      if (!response.ok) {
        setError(body?.error ?? "Não foi possível salvar o link. Tente de novo.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setError("Cole o link da pasta do Drive.");
      return;
    }
    void save(value.trim());
  }

  const cardClass =
    "group flex min-h-[112px] w-full flex-col justify-between rounded-xl border border-[#E4E7EC] bg-white p-4 text-left transition-colors hover:border-[#FF2B00]";

  return (
    <div className="relative">
      {driveUrl ? (
        <>
          <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
            <span className="flex items-center gap-2 text-[#FF2B00]">
              <FolderOpen size={20} aria-hidden />
            </span>
            <span>
              <span className="block truncate pr-8 text-sm font-semibold text-[#101828]">{clientName}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-[#667085]">
                Abrir pasta no Drive
                <ExternalLink size={12} aria-hidden />
              </span>
            </span>
          </a>
          <button
            type="button"
            onClick={openModal}
            aria-label={`Trocar link da pasta de ${clientName}`}
            title="Trocar link"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-[#98A2B3] hover:bg-[#F6F7FB] hover:text-[#101828]"
          >
            <Pencil size={14} aria-hidden />
          </button>
        </>
      ) : (
        <button type="button" onClick={openModal} className={`${cardClass} border-dashed`}>
          <span className="text-[#98A2B3]">
            <FolderPlus size={20} aria-hidden />
          </span>
          <span>
            <span className="block truncate text-sm font-semibold text-[#101828]">{clientName}</span>
            <span className="mt-0.5 block text-xs text-[#98A2B3]">Sem pasta vinculada</span>
          </span>
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={driveUrl ? `Pasta de ${clientName}` : "Nenhuma pasta vinculada ainda"}
        description={
          driveUrl
            ? "Troque o link se a pasta mudou de lugar."
            : `${clientName} ainda não tem uma pasta do Google Drive vinculada. Cole o link da pasta pra vincular.`
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <FormField
            label="Link da pasta no Google Drive"
            name="driveUrl"
            type="url"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
          />
          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            {driveUrl ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void save(null)}
                className="text-sm font-medium text-[#D94343] hover:underline disabled:opacity-60"
              >
                Remover vínculo
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#FF2B00" }}
              >
                {loading ? "Salvando..." : driveUrl ? "Salvar link" : "Vincular pasta"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
