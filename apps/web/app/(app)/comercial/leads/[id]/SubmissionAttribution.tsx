interface Props {
  context: unknown;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function SubmissionAttribution({ context }: Props) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const record = context as Record<string, unknown>;
  const landingUrl = readString(record, "landingUrl");
  const referrer = readString(record, "referrer");
  const fbclid = readString(record, "fbclid");
  const gclid = readString(record, "gclid");
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;
  let landingPath = landingUrl;

  if (landingUrl) {
    try {
      const parsed = new URL(landingUrl);
      landingPath = `${parsed.pathname}${parsed.search}`;
      utmSource = parsed.searchParams.get("utm_source");
      utmMedium = parsed.searchParams.get("utm_medium");
      utmCampaign = parsed.searchParams.get("utm_campaign");
    } catch {
      // Mantém o valor original quando uma integração antiga enviou URL parcial.
    }
  }

  const fields = [
    ["Página de entrada", landingPath],
    ["Origem UTM", utmSource],
    ["Mídia UTM", utmMedium],
    ["Campanha UTM", utmCampaign],
    ["Referência", referrer],
    ["Clique Meta", fbclid],
    ["Clique Google", gclid],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  if (fields.length === 0) return null;
  return (
    <div className="mt-3 border-t border-[#EEF0F3] pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Origem deste interesse</p>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className={label === "Página de entrada" || label === "Referência" ? "sm:col-span-2" : ""}>
            <dt className="text-[#98A2B3]">{label}</dt>
            <dd className="break-all font-medium text-[#475467]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
