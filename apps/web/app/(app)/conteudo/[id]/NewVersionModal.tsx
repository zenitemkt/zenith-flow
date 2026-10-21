"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Film, ImagePlus, X } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import { FormField } from "@/app/_components/FormField";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import {
  CONTENT_MEDIA_MAX_FILES,
  DIRECT_UPLOAD_THRESHOLD_BYTES,
  isVideoType,
  validateContentMediaFile,
} from "@/lib/content-media";
import { formatBytes } from "@/lib/media";

interface UploadedMedia {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * O Instagram só aceita JPEG oficialmente: PNG/WEBP são convertidos no
 * próprio navegador (canvas), com fundo branco onde houver transparência.
 */
async function toJpegIfNeeded(file: File): Promise<File> {
  if (file.type === "image/jpeg" || !file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.(png|webp)$/i, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Sobe um arquivo: pequeno vai pelo servidor; grande (vídeo) vai direto pro
 * R2 com URL assinada. Devolve os dados que a criação da versão precisa.
 */
async function uploadFile(contentId: string, original: File): Promise<UploadedMedia> {
  const file = await toJpegIfNeeded(original);
  const base = { fileName: file.name, contentType: file.type, sizeBytes: file.size };

  if (file.size <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/content/${contentId}/media-upload`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `Não foi possível enviar "${file.name}".`);
    return { ...base, key: body.key };
  }

  const res = await fetch(`/api/content/${contentId}/media-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(base),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Não foi possível preparar o envio de "${file.name}".`);

  const put = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }).catch(() => null);
  if (!put || !put.ok) {
    throw new Error(
      `Não foi possível enviar "${file.name}" (${formatBytes(file.size)}). Arquivos acima de 4MB precisam do CORS liberado no armazenamento — avise o administrador.`,
    );
  }
  return { ...base, key: body.key };
}

export function NewVersionModal({ contentId }: { contentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [assetUrl, setAssetUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guardSubmit = useSubmitGuard();

  function close() {
    if (loading) return;
    setFiles([]);
    setAssetUrl("");
    setNotes("");
    setError(null);
    setProgress(null);
    setOpen(false);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(list)) {
      const invalid = validateContentMediaFile(file);
      if (invalid) {
        setError(invalid);
        continue;
      }
      if (next.length >= CONTENT_MEDIA_MAX_FILES) {
        setError(`No máximo ${CONTENT_MEDIA_MAX_FILES} arquivos (limite do carrossel).`);
        break;
      }
      next.push(file);
    }
    setFiles(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardSubmit(async () => {
      setError(null);
      if (files.length === 0 && !assetUrl.trim()) {
        setError("Envie os arquivos da arte ou cole um link.");
        return;
      }
      setLoading(true);
      try {
        const media: UploadedMedia[] = [];
        for (const [index, file] of files.entries()) {
          setProgress(`Enviando arquivo ${index + 1} de ${files.length}...`);
          media.push(await uploadFile(contentId, file));
        }
        setProgress("Salvando versão...");
        const response = await fetch(`/api/content/${contentId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetUrl, notes, media }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setError(body?.error ?? "Não foi possível adicionar a versão.");
          return;
        }
        setLoading(false);
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no envio.");
      } finally {
        setLoading(false);
        setProgress(null);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center justify-center rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] hover:bg-[#F6F7FB]"
      >
        + Nova versão
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Nova versão"
        description="Envie a arte final (imagem, vídeo ou vários arquivos para carrossel). É ela que o cliente aprova e que será publicada."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-busy={loading}>
          <fieldset disabled={loading} className="flex min-w-0 flex-col gap-3 border-0 p-0">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#D0D5DD] px-4 py-6 text-center hover:border-[#FF2B00] hover:bg-[#FFF9F7]">
              <ImagePlus size={22} className="text-[#667085]" aria-hidden />
              <span className="text-sm font-semibold text-[#101828]">Escolher arquivos</span>
              <span className="text-xs text-[#667085]">JPG, PNG, WEBP (até 8MB) · MP4, MOV (até 300MB) · até 10 arquivos</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {files.length > 0 && (
              <ol className="flex flex-col gap-1.5">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-[#EEF0F3] px-2.5 py-2 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F2F4F7] text-xs font-semibold text-[#475467]">
                      {index + 1}
                    </span>
                    {isVideoType(file.type) && <Film size={14} className="shrink-0 text-[#667085]" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-[#344054]">{file.name}</span>
                    <span className="shrink-0 text-xs text-[#98A2B3]">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      aria-label={`Remover ${file.name}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {files.length > 1 && <p className="text-xs text-[#667085]">Vários arquivos viram um carrossel, nesta ordem.</p>}

            <FormField
              label="Ou link do material (opcional)"
              name="assetUrl"
              type="url"
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="version-notes" className="text-sm font-medium text-[#344054]">
                Notas (opcional)
              </label>
              <textarea
                id="version-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#FF2B00] focus:ring-2 focus:ring-[#EDE9FE]"
              />
            </div>
          </fieldset>

          {progress && <p className="text-sm text-[#667085]">{progress}</p>}
          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {loading ? "Enviando..." : "Adicionar versão"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
