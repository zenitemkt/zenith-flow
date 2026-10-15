interface Props {
  connected: boolean;
  siteUrl: string | null;
  lastError: string | null;
}

/** Status da conexão com o Search Console + link pra conectar — fluxo OAuth é navegação pura (sem fetch). */
export function SearchConsoleConnectionCard({ connected, siteUrl, lastError }: Props) {
  return (
    <section className="rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#101828]">Google Search Console</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${connected ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#F2F4F7] text-[#667085]"}`}>
          {connected ? "Conectado" : "Não conectado"}
        </span>
      </div>
      <p className="mb-3 text-sm text-[#667085]">
        Usado pra priorizar o tema do artigo diário pelas pesquisas reais dos últimos 7 dias. Sem isso,
        o agente usa a lista de temas prioritários do arquivo de regras.
      </p>
      {connected && siteUrl && <p className="mb-2 text-xs text-[#667085]">Site conectado: {siteUrl}</p>}
      {lastError && <p className="mb-2 text-xs text-[#B42318]">Último erro: {lastError}</p>}
      <a
        href="/api/admin/search-console-oauth/start"
        className="inline-flex h-9 items-center rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white"
      >
        {connected ? "Reconectar" : "Conectar Search Console"}
      </a>
    </section>
  );
}
