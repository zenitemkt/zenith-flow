"use client";

import { Facebook, Instagram, Sparkles } from "lucide-react";
import type { SocialPlatform } from "@zenite-mkt/db";
import { WEEKDAY_NAMES, bestTimeFor, weekdayOf } from "@/lib/best-times";

const LABEL: Record<SocialPlatform, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE_BUSINESS: "Google" };
const ICON = { INSTAGRAM: Instagram, FACEBOOK: Facebook, GOOGLE_BUSINESS: null } as const;

/**
 * Um campo de hora (Brasília) por rede marcada, cada um com o botão discreto
 * "melhor horário". O botão lê a data que está no campo Data NO MOMENTO do
 * clique, então vale para o dia que a pessoa digitou, não o que abriu o cartão.
 */
export function PlatformTimeFields({
  platforms,
  date,
  times,
  onChange,
  labelClass,
}: {
  platforms: SocialPlatform[];
  date: string;
  times: Partial<Record<SocialPlatform, string>>;
  onChange: (platform: SocialPlatform, time: string) => void;
  labelClass: string;
}) {
  const weekday = weekdayOf(date);
  return (
    <>
      {platforms.map((platform) => {
        const best = bestTimeFor(platform, date);
        const Icon = ICON[platform];
        const hint =
          best && weekday !== null
            ? `Melhor horário do ${LABEL[platform]} (${WEEKDAY_NAMES[weekday]}): ${best}`
            : "Escolha uma data válida";
        return (
          <label key={platform} className={`flex flex-col gap-1 ${labelClass}`}>
            <span className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1">
                {Icon && <Icon size={12} aria-hidden />}
                {platforms.length > 1 ? `Hora ${LABEL[platform]}` : "Hora (Brasília)"}
              </span>
              <button
                type="button"
                disabled={!best}
                onClick={() => best && onChange(platform, best)}
                title={hint}
                aria-label={hint}
                className="flex h-5 items-center gap-0.5 rounded px-1 text-[11px] font-medium text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#FF2B00] disabled:opacity-40"
              >
                <Sparkles size={11} aria-hidden />
                {best ?? "—"}
              </button>
            </span>
            <input
              type="time"
              value={times[platform] ?? ""}
              onChange={(e) => onChange(platform, e.target.value)}
              className="h-10 rounded-lg border border-[#D0D5DD] px-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
            />
          </label>
        );
      })}
    </>
  );
}
