"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { alertDialog, confirmDialog } from "@/lib/dialogs";

const SELECT = "h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#FF2B00]";

/** Cliente e período da análise (ficam na URL). */
export function CompetitorFilters({ clients, clientId, days, competitorId }: { clients: { id: string; name: string }[]; clientId: string; days: number; competitorId: string | null }) {
  const router = useRouter();
  const go = (next: { cliente?: string; dias?: number }) => {
    const sp = new URLSearchParams();
    sp.set("cliente", next.cliente ?? clientId);
    sp.set("dias", String(next.dias ?? days));
    if (competitorId && !next.cliente) sp.set("c", competitorId);
    router.push(`/concorrentes?${sp.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Cliente" value={clientId} onChange={(e) => go({ cliente: e.target.value })} className={SELECT}>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select aria-label="Período" value={days} onChange={(e) => go({ dias: Number(e.target.value) })} className={SELECT}>
        <option value={30}>Últimos 30 dias</option>
        <option value={90}>Últimos 90 dias</option>
        <option value={180}>Últimos 6 meses</option>
        <option value={365}>Último ano</option>
      </select>
    </div>
  );
}

/** Cadastro de um perfil: concorrente ou o próprio cliente (base de comparação). */
export function AddCompetitorForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"OWN" | "DIRECT" | "REFERENCE">("DIRECT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, username, role }) });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(body?.error ?? "Não foi possível cadastrar.");
      return;
    }
    setUsername("");
    setRole("DIRECT");
    router.push(`/concorrentes?cliente=${clientId}&c=${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-dashed border-[#D0D5DD] bg-white p-4">
      <p className="text-sm font-semibold text-[#101828]">Adicionar perfil do Instagram</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@concorrente ou link do perfil" className="h-10 min-w-0 flex-1 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]" />
        <button type="submit" disabled={busy || !username.trim()} className="h-10 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Buscando dados..." : "Adicionar"}
        </button>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Papel do perfil na análise</legend>
        {([
          ["OWN", "Perfil do cliente", "Base usada para comparar"],
          ["DIRECT", "Concorrente direto", "Entra em rankings e disputa"],
          ["REFERENCE", "Referência de mercado", "Inspira, sem afetar rankings"],
        ] as const).map(([value, title, description]) => (
          <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2.5 ${role === value ? "border-[#FF2B00] bg-[#FFF4ED]" : "border-[#D0D5DD] bg-white"}`}>
            <span className="flex items-start gap-2"><input type="radio" name="competitor-role" value={value} checked={role === value} onChange={() => setRole(value)} className="mt-0.5 h-4 w-4 accent-[#FF2B00]" /><span><span className="block text-xs font-semibold text-[#101828]">{title}</span><span className="mt-0.5 block text-[11px] leading-4 text-[#667085]">{description}</span></span></span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-[#98A2B3]">Só contas comerciais ou de criador. Conta pessoal ou privada não pode ser lida.</p>
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">
          <p>{error}</p>
          {/autorizada|reconecte/i.test(error) && (
            <a href={`/api/social/meta/start?clientId=${clientId}`} className="rounded-lg border border-[#FDA29B] bg-white px-3 py-1.5 font-semibold text-[#B42318] hover:bg-[#FFF5F4]">
              Reconectar Facebook/Instagram
            </a>
          )}
        </div>
      )}
    </form>
  );
}

/** Atualizar agora, analisar com IA e remover. */
export function CompetitorActions({ competitorId, days, username, hasReport, currentRole }: { competitorId: string; days: number; username: string; hasReport: boolean; currentRole: "OWN" | "DIRECT" | "REFERENCE" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "website" | "ai" | "role" | "delete" | null>(null);

  async function changeRole(role: "OWN" | "DIRECT" | "REFERENCE") {
    setBusy("role");
    const res = await fetch(`/api/competitors/${competitorId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) await alertDialog(body?.error ?? "Não foi possível alterar o papel do perfil.", { title: "Papel não alterado" });
    router.refresh();
  }

  async function run(kind: "sync" | "website" | "ai") {
    setBusy(kind);
    const res = await fetch(`/api/competitors/${competitorId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "ai" ? { action: "analyze", days } : kind === "website" ? { action: "website" } : { action: "sync", deep: true }) });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) await alertDialog(body?.error ?? "Não foi possível concluir.", { title: kind === "ai" ? "Análise não gerada" : "Não atualizou" });
    router.refresh();
  }

  async function remove() {
    if (!(await confirmDialog(`Remover @${username} e todo o histórico guardado dele?`, { title: "Remover perfil", confirmLabel: "Remover", danger: true }))) return;
    setBusy("delete");
    await fetch(`/api/competitors/${competitorId}`, { method: "DELETE" });
    setBusy(null);
    router.push("/concorrentes");
    router.refresh();
  }

  const BTN = "flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] disabled:opacity-60";
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Papel do perfil" value={currentRole} disabled={busy !== null} onChange={(event) => void changeRole(event.target.value as "OWN" | "DIRECT" | "REFERENCE")} className="h-9 rounded-lg border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054] outline-none focus:border-[#FF2B00] disabled:opacity-60">
        <option value="OWN">Perfil do cliente</option><option value="DIRECT">Concorrente direto</option><option value="REFERENCE">Referência de mercado</option>
      </select>
      <button type="button" disabled={busy !== null} onClick={() => void run("sync")} className={BTN}>
        <RefreshCw size={14} aria-hidden /> {busy === "sync" ? "Atualizando..." : "Atualizar agora"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void run("website")} className={BTN}>
        <Gauge size={14} aria-hidden /> {busy === "website" ? "Medindo site..." : "Medir site"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void run("ai")} className="flex h-9 items-center gap-1.5 rounded-lg bg-[#101828] px-3 text-xs font-semibold text-white disabled:opacity-60">
        <Sparkles size={14} aria-hidden /> {busy === "ai" ? "Analisando (até 1 min)..." : hasReport ? "Refazer análise com IA" : "Analisar melhores posts com IA"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void remove()} aria-label="Remover perfil" className={`${BTN} hover:text-[#B42318]`}>
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}
