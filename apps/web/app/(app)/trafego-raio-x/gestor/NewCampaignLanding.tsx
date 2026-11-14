import Link from "next/link";
import { Plus } from "lucide-react";

interface DraftCard {
  id: string;
  title: string;
  status: "DRAFT" | "SUBMITTING" | "SUBMITTED" | "FAILED";
  updatedAt: string;
  adsets: number;
  creatives: number;
  lastError: string | null;
}

const STATUS = {
  DRAFT: { label: "Rascunho", cls: "bg-[#F2F4F7] text-[#344054]" },
  SUBMITTING: { label: "Subindo (incompleta)", cls: "bg-[#EFF8FF] text-[#175CD3]" },
  SUBMITTED: { label: "Na Meta", cls: "bg-[#ECFDF3] text-[#027A48]" },
  FAILED: { label: "Falhou ao subir", cls: "bg-[#FEF3F2] text-[#B42318]" },
} as const;

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Entrada da aba Nova campanha: criar do zero ou continuar um rascunho (o assistente abre numa janela). */
export function NewCampaignLanding({ drafts }: { drafts: DraftCard[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/trafego-raio-x/gestor?aba=nova&novo=1`} className="flex items-center gap-4 rounded-xl border border-dashed border-[#FF2B00] bg-white p-5 hover:bg-[#F9FAFB]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF2B00] text-white">
          <Plus size={20} aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#101828]">Criar nova campanha</span>
          <span className="block text-xs text-[#667085]">Abre o assistente: campanha, conjuntos, formulário ou site, anúncios e revisão.</span>
        </span>
      </Link>

      {drafts.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Rascunhos ({drafts.length})</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((d) => (
              <Link key={d.id} href={`/trafego-raio-x/gestor?aba=nova&campanha=${d.id}`} className="flex flex-col gap-2 rounded-xl border border-[#E4E7EC] bg-white p-4 hover:border-[#FF2B00]">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#101828]">{d.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS[d.status].cls}`}>{STATUS[d.status].label}</span>
                </div>
                <p className="text-xs text-[#667085]">
                  {d.adsets} conjunto(s) · {d.creatives} criativo(s) · editado {fmt(d.updatedAt)}
                </p>
                {d.lastError && d.status === "FAILED" && <p className="line-clamp-2 text-xs text-[#B42318]">{d.lastError}</p>}
                <span className="mt-auto text-xs font-semibold text-[#FF2B00]">{d.status === "DRAFT" ? "Continuar" : "Revisar e tentar de novo"} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
