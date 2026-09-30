"use client";

/** Só navega pro início do fluxo OAuth (rota GET, redireciona pra Meta) — sem estado próprio. */
export function ConnectMetaButton() {
  return (
    <a
      href="/api/integrations/meta/oauth/start"
      className="inline-flex items-center justify-center rounded-lg bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#166FE5]"
    >
      Conectar conta da Meta
    </a>
  );
}
