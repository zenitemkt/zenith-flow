"use client";

import { CONTENT_CHANNEL_LABELS } from "@/lib/content";
import { CONTENT_CHANNELS, CONTENT_FORMATS, artSizes } from "@/lib/content-formats";

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Redes e formatos da peça (vários de cada) + as pranchetas que o designer vai entregar. */
export function ChannelFormatPicker({
  channels,
  formats,
  onChannelsChange,
  onFormatsChange,
}: {
  channels: string[];
  formats: string[];
  onChannelsChange: (next: string[]) => void;
  onFormatsChange: (next: string[]) => void;
}) {
  const sizes = artSizes(channels, formats);
  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-[#FF2B00] bg-[#FFF1EC] text-[#C4320A]" : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"}`;

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-[#344054]">Redes (marque todas onde a arte vai)</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_CHANNELS.map((value) => (
            <button key={value} type="button" aria-pressed={channels.includes(value)} onClick={() => onChannelsChange(toggle(channels, value))} className={chip(channels.includes(value))}>
              {CONTENT_CHANNEL_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-[#344054]">Formatos (pode marcar mais de um)</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_FORMATS.map((value) => (
            <button key={value} type="button" aria-pressed={formats.includes(value)} onClick={() => onFormatsChange(toggle(formats, value))} className={chip(formats.includes(value))}>
              {value}
            </button>
          ))}
        </div>
      </fieldset>
      {sizes.length > 0 && (
        <div className="rounded-lg border border-[#EAECF0] bg-[#F9FAFB] px-3 py-2">
          <p className="text-xs font-semibold text-[#344054]">Tamanhos da arte ({sizes.length} prancheta{sizes.length === 1 ? "" : "s"})</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {sizes.map((s) => (
              <li key={`${s.channel}-${s.format}`} className="flex justify-between gap-3 text-xs text-[#475467]">
                <span>
                  {CONTENT_CHANNEL_LABELS[s.channel]} · {s.format}
                </span>
                <span className="font-medium tabular-nums text-[#101828]">{s.size ?? "a definir"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
