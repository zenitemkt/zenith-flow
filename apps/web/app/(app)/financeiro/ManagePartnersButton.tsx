"use client";

import { confirmDialog } from "@/lib/dialogs";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Modal } from "@zenite-mkt/ui";
import type { PartnerChoice } from "./PartnerSplitFields";
import type { PartnerLogin } from "./partner-choices";

/**
 * Cadastro dos sócios: adicionar, desativar/reativar e ligar cada um ao
 * próprio login. Com o login ligado, os lançamentos particulares do sócio
 * (os que são só dele) ficam visíveis apenas para ele.
 */
export function ManagePartnersButton({
  partners,
  canManage,
  logins = [],
}: {
  partners: PartnerChoice[];
  canManage: boolean;
  /** Logins da equipe para ligar a um sócio (só vem para administradores). */
  logins?: PartnerLogin[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: "POST" | "PATCH", body: unknown) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Não foi possível salvar.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (await call("/api/finance/partners", "POST", { name })) setName("");
  }

  async function link(partner: PartnerChoice, userId: string) {
    const login = logins.find((l) => l.userId === userId);
    const question = userId
      ? `Ligar ${partner.name} ao login ${login?.label ?? ""}? Os lançamentos particulares de ${partner.name} passam a aparecer só para esse login.`
      : `Desligar o login de ${partner.name}? Os lançamentos particulares dele voltam a aparecer para toda a equipe.`;
    if (!await confirmDialog(question)) return;
    await call(`/api/finance/partners/${partner.id}`, "PATCH", { userId: userId || null });
  }

  const takenBy = (userId: string) => partners.find((p) => p.userId === userId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F6F7FB]"
      >
        <Users size={16} aria-hidden />
        Sócios
      </button>
      <Modal
        open={open}
        onClose={() => {
          setError(null);
          setOpen(false);
        }}
        title="Sócios"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#667085]">
            Lançamento dividido entre os sócios é da <strong>Zenite</strong>. Lançamento de um sócio só é <strong>particular</strong>: não entra
            nos números da Zenite e, com o login ligado, só o próprio sócio vê.
          </p>
          {partners.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#E4E7EC] px-3 py-4 text-center text-sm text-[#667085]">Nenhum sócio cadastrado ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#EEF0F3] rounded-lg border border-[#E4E7EC]">
              {partners.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`min-w-0 truncate font-medium ${p.active ? "text-[#101828]" : "text-[#98A2B3] line-through"}`}>{p.name}</span>
                    {canManage && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void call(`/api/finance/partners/${p.id}`, "PATCH", { active: !p.active })}
                        className="shrink-0 text-xs font-semibold text-[#475467] hover:text-[#FF2B00] disabled:opacity-60"
                      >
                        {p.active ? "Desativar" : "Reativar"}
                      </button>
                    )}
                  </div>
                  {canManage ? (
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#475467]">
                      Login deste sócio
                      <select
                        value={p.userId ?? ""}
                        disabled={busy}
                        onChange={(e) => void link(p, e.target.value)}
                        className="h-9 w-full min-w-0 rounded-lg border border-[#D0D5DD] bg-white px-2 text-sm text-[#101828] outline-none focus:border-[#FF2B00]"
                      >
                        <option value="">Sem login ligado (particular visível para a equipe)</option>
                        {logins.map((l) => {
                          const other = takenBy(l.userId);
                          return (
                            <option key={l.userId} value={l.userId} disabled={Boolean(other && other.id !== p.id)}>
                              {l.label}
                              {other && other.id !== p.id ? ` — já ligado a ${other.name}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  ) : (
                    <span className="text-xs text-[#667085]">{p.userId ? "Login ligado" : "Sem login ligado"}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <form onSubmit={add} className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do sócio"
                aria-label="Nome do sócio"
                maxLength={60}
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="h-10 shrink-0 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#FF2B00" }}
              >
                Adicionar
              </button>
            </form>
          ) : (
            <p className="text-xs text-[#667085]">Só administradores cadastram sócios.</p>
          )}
          {error && <p className="text-sm font-medium text-[#D94343]">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
