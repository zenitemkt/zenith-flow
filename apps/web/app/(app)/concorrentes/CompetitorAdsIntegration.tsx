"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, RotateCw, X } from "lucide-react";
import { alertDialog, confirmDialog } from "@/lib/dialogs";

export function CompetitorAdsIntegration({ configured, competitorId, username }: { configured: boolean; competitorId: string | null; username: string | null }) {
  const [open, setOpen] = useState(false);
  const [hasToken, setHasToken] = useState(configured);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function generate() {
    if (hasToken && !(await confirmDialog("Gerar uma chave nova desconecta a chave anterior da extensão. Continuar?", { title: "Trocar chave da extensão", confirmLabel: "Gerar nova chave", danger: true }))) return;
    setBusy(true);
    const response = await fetch("/api/competitors/integration-token", { method: "POST" });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return alertDialog(body?.error ?? "Não foi possível gerar a chave.", { title: "Chave não gerada" });
    setToken(body.token);
    setHasToken(true);
  }

  async function revoke() {
    if (!(await confirmDialog("A extensão deixará de enviar anúncios até uma nova chave ser configurada.", { title: "Revogar chave", confirmLabel: "Revogar", danger: true }))) return;
    setBusy(true);
    const response = await fetch("/api/competitors/integration-token", { method: "DELETE" });
    setBusy(false);
    if (!response.ok) return alertDialog("Não foi possível revogar a chave.", { title: "Chave não revogada" });
    setToken(null);
    setHasToken(false);
  }

  const CopyButton = ({ label, value }: { label: string; value: string }) => (
    <button type="button" onClick={() => void copy(label, value)} aria-label={`Copiar ${label}`} className="rounded-md border border-[#D0D5DD] bg-white p-1.5 text-[#475467] hover:text-[#FF2B00]">
      {copied === label ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
    </button>
  );

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]"><KeyRound size={16} className="text-[#FF2B00]" aria-hidden /> Integração com a Biblioteca de Anúncios</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${hasToken ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F2F4F7] text-[#667085]"}`}>{hasToken ? "Chave criada" : "Configurar"}</span>
      </button>
      {open && (
        <div className="border-t border-[#EAECF0] p-4">
          <p className="max-w-3xl text-xs leading-relaxed text-[#667085]">A extensão envia os anúncios públicos carregados na Biblioteca da Meta. A chave identifica a agência e fica guardada somente no navegador em que a extensão foi configurada.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className="text-xs font-semibold text-[#344054]">Endereço do sistema</p>
              <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-xs text-[#475467]">https://portal.hubzenite.com.br</code><CopyButton label="endereço" value="https://portal.hubzenite.com.br" /></div>
            </div>
            <div className="rounded-lg bg-[#F9FAFB] p-3">
              <p className="text-xs font-semibold text-[#344054]">Concorrente selecionado{username ? `: @${username}` : ""}</p>
              {competitorId ? <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate text-xs text-[#475467]">{competitorId}</code><CopyButton label="concorrente" value={competitorId} /></div> : <p className="mt-1 text-xs text-[#98A2B3]">Selecione ou cadastre um perfil.</p>}
            </div>
          </div>
          {token && (
            <div className="mt-3 rounded-lg border border-[#FEDF89] bg-[#FFFAEB] p-3">
              <p className="text-xs font-semibold text-[#93370D]">Copie a chave agora. Por segurança, ela não será mostrada novamente.</p>
              <div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-[#7A2E0E]">{token}</code><CopyButton label="chave" value={token} /></div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void generate()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#101828] px-3 text-xs font-semibold text-white disabled:opacity-60"><RotateCw size={14} aria-hidden />{hasToken ? "Gerar nova chave" : "Gerar chave"}</button>
            {hasToken && <button type="button" disabled={busy} onClick={() => void revoke()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#FDA29B] px-3 text-xs font-semibold text-[#B42318] disabled:opacity-60"><X size={14} aria-hidden />Revogar</button>}
          </div>
        </div>
      )}
    </section>
  );
}

