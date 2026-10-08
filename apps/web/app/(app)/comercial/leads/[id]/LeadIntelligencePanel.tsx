import type { Touchpoint } from "@/lib/attribution";
import type { LeadIntelligence } from "@/lib/lead-intelligence";

interface Props {
  intelligence: LeadIntelligence;
  firstTouch: Touchpoint | null;
  lastTouch: Touchpoint | null;
  fallbackSource: string | null;
}

function formatDate(date: Date) {
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function LeadIntelligencePanel({ intelligence, firstTouch, lastTouch, fallbackSource }: Props) {
  const temperatureLabel = intelligence.temperature === "ALTO" ? "alto" : intelligence.temperature === "MEDIO" ? "médio" : "baixo";
  const temperatureClass = intelligence.temperature === "ALTO"
    ? "bg-[#ECFDF3] text-[#027A48]"
    : intelligence.temperature === "MEDIO"
      ? "bg-[#FFFAEB] text-[#B54708]"
      : "bg-[#F2F4F7] text-[#475467]";

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#101828]">Inteligência comercial</h2>
          <p className="mt-1 text-xs text-[#667085]">Pontuação explicável baseada somente em sinais reais desta jornada.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-[#101828]">
            {intelligence.score}<span className="text-sm font-normal text-[#98A2B3]">/100</span>
          </p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${temperatureClass}`}>
            Interesse {temperatureLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[#EEF0F3] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">Primeira origem</p>
          <p className="mt-1 text-sm font-semibold text-[#101828]">{firstTouch?.channel ?? fallbackSource ?? "Não identificada"}</p>
          {firstTouch && <p className="text-xs text-[#667085]">{formatDate(firstTouch.occurredAt)}</p>}
        </div>
        <div className="rounded-lg border border-[#EEF0F3] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[#98A2B3]">Origem mais recente</p>
          <p className="mt-1 text-sm font-semibold text-[#101828]">{lastTouch?.channel ?? fallbackSource ?? "Não identificada"}</p>
          {lastTouch && <p className="text-xs text-[#667085]">{formatDate(lastTouch.occurredAt)}</p>}
        </div>
      </div>

      {intelligence.signals.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {intelligence.signals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded-lg border p-3 ${signal.tone === "hot" ? "border-[#ABEFC6] bg-[#ECFDF3]" : "border-[#FEDF89] bg-[#FFFAEB]"}`}
            >
              <p className="text-sm font-semibold text-[#101828]">{signal.label}</p>
              <p className="mt-0.5 text-xs text-[#667085]">{signal.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
