"use client";

import { useEffect, useState } from "react";

export type CoverMode = "auto" | "frame" | "image";

export interface CoverValue {
  mode: CoverMode;
  seconds: number;
  file: File | null;
  /** Capa já salva no agendamento (mantida se nenhuma imagem nova for escolhida). */
  savedKey?: string | null;
  savedUrl?: string | null;
}

export const emptyCover: CoverValue = { mode: "auto", seconds: 0, file: null };

/** Capa do vídeo no Instagram: automática, um momento do vídeo ou uma imagem enviada. */
export function VideoCoverPicker({ videoUrl, value, onChange }: { videoUrl: string | null; value: CoverValue; onChange: (v: CoverValue) => void }) {
  const [duration, setDuration] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value.file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-3">
      <p className="text-sm font-medium text-[#101828]">Capa do vídeo (Instagram)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {([["auto", "Automática"], ["frame", "Momento do vídeo"], ["image", "Enviar imagem"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...value, mode })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${value.mode === mode ? "bg-[#101828] text-white" : "border border-[#D0D5DD] bg-white text-[#344054]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {value.mode === "auto" && <p className="mt-2 text-xs text-[#667085]">O Instagram escolhe a capa.</p>}
      {value.mode === "frame" && videoUrl && (
        <div className="mt-2 flex flex-col gap-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            className="mx-auto max-h-64 rounded-lg bg-black"
            ref={(el) => {
              if (el && el.readyState >= 1 && Math.abs(el.currentTime - value.seconds) > 0.05) el.currentTime = value.seconds;
            }}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              e.currentTarget.currentTime = value.seconds;
            }}
          />
          <label className="flex items-center gap-2 text-xs text-[#344054]">
            <input
              type="range"
              min={0}
              max={Math.max(0.1, Math.floor(duration * 10) / 10)}
              step={0.1}
              value={value.seconds}
              onChange={(e) => onChange({ ...value, seconds: Number(e.target.value) })}
              className="flex-1 accent-[#FF2B00]"
            />
            <span className="w-14 text-right">{value.seconds.toFixed(1)} s</span>
          </label>
        </div>
      )}
      {value.mode === "image" && (
        <div className="mt-2 flex flex-col gap-2 text-xs text-[#667085]">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })} className="text-xs" />
          {(imageUrl ?? value.savedUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(imageUrl ?? value.savedUrl)!} alt="Capa escolhida" className="mx-auto max-h-64 rounded-lg" />
          )}
          {!imageUrl && value.savedUrl && <span>Capa atual. Escolha outro arquivo para trocar.</span>}
          Imagem vertical 9:16 (1080×1920) fica melhor.
        </div>
      )}
    </div>
  );
}

/** Para a prévia: imagem da capa (link local) ou segundo do vídeo. */
export function useCoverPreview(value: CoverValue) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (value.mode !== "image" || !value.file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.mode, value.file]);
  if (value.mode === "image") {
    const url = imageUrl ?? value.savedUrl ?? null;
    return url ? { imageUrl: url, seconds: null } : null;
  }
  if (value.mode === "frame") return { imageUrl: null, seconds: value.seconds };
  return null;
}
