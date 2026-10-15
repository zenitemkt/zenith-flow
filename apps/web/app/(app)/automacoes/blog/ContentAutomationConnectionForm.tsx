"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

interface Props {
  connected: boolean;
  githubOwner: string | null;
  githubRepo: string | null;
  githubBranch: string | null;
}

/** Configura o repositório de destino do blog e gera a chave que a rotina agendada (o "agente externo") usa pra autenticar. */
export function ContentAutomationConnectionForm({ connected, githubOwner, githubRepo, githubBranch }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [owner, setOwner] = useState(githubOwner ?? "zenitemkt");
  const [repo, setRepo] = useState(githubRepo ?? "zenitehub");
  const [branch, setBranch] = useState(githubBranch ?? "main");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newAgentKey, setNewAgentKey] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/content-automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubOwner: owner, githubRepo: repo, githubBranch: branch, githubToken: token }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível salvar.");
        return;
      }
      if (data.agentApiKey) setNewAgentKey(data.agentApiKey);
      setToken("");
      toast.success("Conexão salva.");
      router.refresh();
    } catch {
      toast.error("Erro de rede — tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateAgentKey() {
    setRegenerating(true);
    try {
      const response = await fetch("/api/admin/content-automation/regenerate-agent-key", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Não foi possível gerar a chave.");
        return;
      }
      setNewAgentKey(data.agentApiKey);
      toast.success("Nova chave gerada — rotinas com a chave antiga vão parar de funcionar.");
    } catch {
      toast.error("Erro de rede — tente novamente.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#101828]">Conexão com o repositório do site</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${connected ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F2F4F7] text-[#667085]"}`}>
          {connected ? "Configurada" : "Não configurada"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Owner do GitHub
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Repositório
          <input value={repo} onChange={(e) => setRepo(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#475467]">
          Branch
          <input value={branch} onChange={(e) => setBranch(e.target.value)} className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]" />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs font-medium text-[#475467]">
        Personal Access Token do GitHub (escopo só neste repositório)
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={connected ? "Já configurado — preencha só pra trocar" : "ghp_..."}
          className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !owner.trim() || !repo.trim() || (!connected && !token.trim())}
          className="h-9 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar conexão"}
        </button>
        {connected && (
          <button
            type="button"
            onClick={regenerateAgentKey}
            disabled={regenerating}
            className="h-9 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#475467] disabled:opacity-50"
          >
            {regenerating ? "Gerando…" : "Gerar nova chave de agente"}
          </button>
        )}
      </div>
      {newAgentKey && (
        <div className="mt-3 rounded-lg border border-[#FEC84B] bg-[#FFFCF5] p-3">
          <p className="text-xs font-semibold text-[#B54708]">
            Chave de agente gerada — copie agora, não aparece de novo: configure como <code>x-draft-agent-key</code> na rotina agendada.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={newAgentKey}
              onFocus={(e) => e.currentTarget.select()}
              style={{ background: "#ffffff", color: "#101828" }}
              className="h-9 flex-1 rounded-lg border border-[#D0D5DD] px-3 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newAgentKey).then(
                  () => toast.success("Chave copiada."),
                  () => toast.error("Não foi possível copiar — selecione o texto manualmente."),
                );
              }}
              className="h-9 shrink-0 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#475467]"
            >
              Copiar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
