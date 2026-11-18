import { CheckCircle2, Gauge, MapPinned, XCircle } from "lucide-react";

interface Check { id: string; label: string; ok: boolean; detail: string }

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-2 text-xs">
          {check.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#12B76A]" /> : <XCircle size={14} className="mt-0.5 shrink-0 text-[#F04438]" />}
          <span>
            <span className="font-medium text-[#344054]">{check.label}</span>
            <span className="text-[#98A2B3]"> — {check.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** SEO on-page do site (aba Site), a partir do checklist e da nota do PageSpeed. */
export function WebsiteSeoCard({
  website,
  seoScore,
  seoChecks,
  seoCheckedAt,
  seoError,
}: {
  website: string | null;
  seoScore: number | null;
  seoChecks: Check[] | null;
  seoCheckedAt: string | null;
  seoError: string | null;
}) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <Gauge size={16} className="text-[#FF2B00]" />
        <h2 className="text-sm font-semibold text-[#101828]">SEO on-page</h2>
        {seoScore !== null && <span className="ml-auto text-lg font-semibold text-[#101828]">{seoScore}/100</span>}
      </div>
      {!website ? (
        <p className="text-xs text-[#98A2B3]">Este perfil ainda não tem um site definido.</p>
      ) : !seoChecks ? (
        <p className="text-xs text-[#98A2B3]">{seoError ?? 'Ainda não medido. Use o botão "Medir site".'}</p>
      ) : (
        <>
          <CheckList checks={seoChecks} />
          {seoCheckedAt && <p className="mt-2 text-[11px] text-[#98A2B3]">Analisado em {seoCheckedAt}. A nota de SEO é a parte &quot;SEO&quot; do mesmo teste de velocidade do PageSpeed.</p>}
        </>
      )}
    </section>
  );
}

/** Completude pública do perfil do Google (aba Google Meu Negócio). */
export function GoogleProfileCard({ googleLinked, googleProfileChecks }: { googleLinked: boolean; googleProfileChecks: Check[] | null }) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <MapPinned size={16} className="text-[#FF2B00]" />
        <h2 className="text-sm font-semibold text-[#101828]">Completude do perfil</h2>
      </div>
      {!googleLinked ? (
        <p className="text-xs text-[#98A2B3]">Vincule um estabelecimento do Google acima para ver a completude do perfil.</p>
      ) : !googleProfileChecks ? (
        <p className="text-xs text-[#98A2B3]">Atualize o Google para carregar a completude do perfil.</p>
      ) : (
        <CheckList checks={googleProfileChecks} />
      )}
    </section>
  );
}
