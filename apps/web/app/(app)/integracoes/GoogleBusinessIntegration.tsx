"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, ExternalLink, Settings2, Unplug } from "lucide-react";
import Link from "next/link";
import { useToast } from "@zenite-mkt/ui";
import { confirmDialog } from "@/lib/dialogs";

const RESULT: Record<string, string> = {
  connected: "Conta Google Business Profile conectada.", denied: "A autorização foi cancelada.", invalid_state: "A sessão de conexão expirou. Tente novamente.", missing_refresh_token: "O Google não devolveu acesso permanente. Tente conectar novamente.", error: "Não foi possível concluir a conexão.", forbidden: "Apenas administradores podem conectar.", not_configured: "A estrutura está pronta. As credenciais serão adicionadas após a aprovação do Google.",
};

interface Props { configured: boolean; canManage: boolean; connection: { email: string | null; status: string; lastValidatedAt: string | null; locationCount: number } | null }

export function GoogleBusinessIntegration({ configured, canManage, connection }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const result = params.get("googleBusiness");
    if (!result) return;
    if (result === "connected") toast.success(RESULT[result] ?? "Conta conectada."); else toast.error(RESULT[result] ?? "Não foi possível conectar.");
    router.replace("/integracoes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnect() {
    if (!(await confirmDialog("Desconectar a conta Google e remover os vínculos de localizações? Publicações e automações futuras serão interrompidas.", { title: "Desconectar Google Business Profile", confirmLabel: "Desconectar", danger: true }))) return;
    setBusy(true);
    const response = await fetch("/api/integrations/google-business/disconnect", { method: "POST" });
    setBusy(false);
    if (!response.ok) return toast.error("Não foi possível desconectar.");
    toast.success("Google Business Profile desconectado."); router.refresh();
  }

  const active = connection?.status === "ACTIVE";
  return <section className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
    <div className="flex flex-col gap-4 border-b border-[#EEF0F3] p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF4ED] text-[#FF2B00]"><Building2 size={18} /></span><div><h2 className="text-sm font-semibold text-[#101828]">Google Business Profile</h2><p className="text-[11px] text-[#98A2B3]">Antigo Google Meu Negócio</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? "bg-[#ECFDF3] text-[#027A48]" : configured ? "bg-[#F2F4F7] text-[#667085]" : "bg-[#FFFAEB] text-[#B54708]"}`}>{active ? "Conectada" : configured ? "Não conectada" : "Aguardando aprovação"}</span></div>
        {connection ? <p className="max-w-2xl text-sm text-[#667085]">Conta <span className="font-medium text-[#344054]">{connection.email ?? "Google autorizada"}</span>. {connection.locationCount === 0 ? "Nenhuma localização vinculada a cliente ainda." : `${connection.locationCount} localização(ões) vinculada(s).`}</p> : <p className="max-w-2xl text-sm text-[#667085]">Conectará avaliações, respostas, publicações e métricas das localizações autorizadas. A análise pública de concorrentes continuará usando Google Places separadamente.</p>}
      </div>
      <div className="flex flex-wrap gap-2"><Link href="/automacoes/avaliacoes-google" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054]"><Settings2 size={14} />Configurar avaliações</Link>{canManage && (connection ? <button disabled={busy} onClick={() => void disconnect()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#B42318] disabled:opacity-60"><Unplug size={14} />{busy ? "Desconectando..." : "Desconectar"}</button> : configured ? <a href="/api/integrations/google-business/start" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#101828] px-3 text-xs font-semibold text-white">Conectar com Google <ExternalLink size={14} /></a> : null)}</div>
    </div>
    <div className="grid gap-px bg-[#EEF0F3] sm:grid-cols-3">
      <div className="bg-[#F9FAFB] p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-[#344054]"><CheckCircle2 size={14} className={active ? "text-[#12B76A]" : "text-[#98A2B3]"} />Avaliações</p><p className="mt-1 text-xs text-[#667085]">Leitura, fila manual e respostas autorizadas.</p></div>
      <div className="bg-[#F9FAFB] p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-[#344054]"><CheckCircle2 size={14} className={active ? "text-[#12B76A]" : "text-[#98A2B3]"} />Publicações</p><p className="mt-1 text-xs text-[#667085]">Posts do Google integrados à Operação.</p></div>
      <div className="bg-[#F9FAFB] p-4"><p className="flex items-center gap-1.5 text-xs font-semibold text-[#344054]"><CheckCircle2 size={14} className={active ? "text-[#12B76A]" : "text-[#98A2B3]"} />Métricas</p><p className="mt-1 text-xs text-[#667085]">Desempenho e reputação junto da Fase 3B.</p></div>
    </div>
    {!configured && <div className="border-t border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-xs text-[#B54708]">Solicitação do Google em análise, protocolo 4-4339000042452. Depois da aprovação, basta cadastrar as credenciais protegidas na Vercel.</div>}
  </section>;
}
