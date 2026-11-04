"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface MetaLeadPage {
  connectionId: string;
  clientId: string;
  clientName: string;
  pageName: string;
  enabled: boolean;
  lastError: string | null;
  imported: number;
  failed: number;
  lastLeadAt: string | null;
}

interface Form {
  id: string;
  name: string;
  status: string;
  leadsCount: number | null;
}

export function MetaLeadsIntegration({ pages, canManage }: { pages: MetaLeadPage[]; canManage: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-[#EEF0F3]">
      {pages.length === 0 ? (
        <p className="p-4 text-sm text-[#667085]">
          Nenhuma Página do Facebook conectada. Conecte a Página da agência em Clientes → perfil do cliente → Conectar Facebook/Instagram.
        </p>
      ) : (
        pages.map((page) => <PageRow key={page.connectionId} page={page} canManage={canManage} />)
      )}
    </div>
  );
}

function PageRow({ page, canManage }: { page: MetaLeadPage; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(page.lastError);
  const [forms, setForms] = useState<Form[] | null>(null);

  async function call(method: "GET" | "PATCH" | "POST", body?: object) {
    const url = method === "GET" ? `/api/integrations/meta-leads?connectionId=${page.connectionId}` : "/api/integrations/meta-leads";
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify({ connectionId: page.connectionId, ...body }) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Falha na operação.");
    return result;
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
    }
    setBusy(null);
  }

  const missingPermission = message?.toLowerCase().includes("permission") || message?.includes("leads_retrieval");

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#101828]">{page.pageName}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${page.enabled ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F2F4F7] text-[#667085]"}`}>
              {page.enabled ? "Recebendo leads" : "Desligada"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#667085]">
            Conectada no cliente {page.clientName} · {page.imported} {page.imported === 1 ? "lead recebido" : "leads recebidos"}
            {page.failed > 0 && ` · ${page.failed} com falha`}
            {page.lastLeadAt && ` · último em ${new Date(page.lastLeadAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/social/meta/start?clientId=${page.clientId}&leads=1`} className="inline-flex h-9 items-center rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
              Dar permissão de leads
            </a>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run("forms", async () => setForms((await call("GET")).forms))}
              className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              {busy === "forms" ? "Buscando..." : "Ver formulários"}
            </button>
            {page.enabled && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run("import", async () => {
                    const r = await call("POST");
                    setMessage(`${r.imported} importados, ${r.duplicate} já estavam no CRM${r.failed ? `, ${r.failed} com falha` : ""} (${r.forms} formulários).`);
                    router.refresh();
                  })
                }
                className="h-9 rounded-lg border border-[#D0D5DD] px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                {busy === "import" ? "Importando..." : "Importar últimos 90 dias"}
              </button>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run("toggle", async () => {
                  await call("PATCH", { enabled: !page.enabled });
                  router.refresh();
                })
              }
              className={`h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-50 ${page.enabled ? "border border-[#D0D5DD] text-[#344054]" : "bg-[#FF2B00] text-white"}`}
            >
              {busy === "toggle" ? "Salvando..." : page.enabled ? "Desligar" : "Ativar leads no CRM"}
            </button>
          </div>
        )}
      </div>

      {message && (
        <p className={`rounded-lg p-2.5 text-xs ${missingPermission ? "bg-[#FEF3C7] text-[#92600A]" : "bg-[#F9FAFB] text-[#344054]"}`}>
          {message}
          {missingPermission && " Clique em “Dar permissão de leads”, autorize na Meta e escolha esta Página de novo."}
        </p>
      )}

      {forms && (
        <div className="rounded-lg border border-[#EEF0F3]">
          {forms.length === 0 ? (
            <p className="p-3 text-xs text-[#667085]">Nenhum formulário nesta Página ainda.</p>
          ) : (
            forms.map((form) => (
              <div key={form.id} className="flex items-center justify-between gap-2 border-b border-[#EEF0F3] px-3 py-2 text-xs last:border-0">
                <span className="font-medium text-[#344054]">{form.name}</span>
                <span className="text-[#667085]">
                  {form.status === "ACTIVE" ? "ativo" : form.status.toLowerCase()}
                  {form.leadsCount !== null && ` · ${form.leadsCount} leads`}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
