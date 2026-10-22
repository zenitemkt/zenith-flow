"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

/**
 * Filtro por cliente em caixa de seleção (pedido do usuário, 2026-10-20): no
 * lugar de uma fileira de botões, que não escala com muitos clientes. Abre pra
 * baixo, com busca, e navega por `basePath?clientId=` como o `ClientFilterPills` fazia.
 */
export function ClientFilterSelect({
  clients,
  activeClientId,
  basePath,
  params,
}: {
  clients: ClientOption[];
  activeClientId?: string;
  /** Rota da página; o filtro vira `?clientId=`. (Função não passa de Server pra Client Component.) */
  basePath: string;
  /** Outros parâmetros da URL a manter ao trocar de cliente (ex.: `month` no Calendário). */
  params?: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  if (clients.length === 0) return null;

  const active = clients.find((c) => c.id === activeClientId);

  function choose(clientId?: string) {
    setOpen(false);
    setQuery("");
    const query = new URLSearchParams(params);
    if (clientId) query.set("clientId", clientId);
    const qs = query.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full items-center sm:h-10 sm:w-auto sm:min-w-[220px] justify-between gap-3 rounded-xl border border-[#E4E7EC] bg-white px-3.5 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
      >
        <span className="truncate">{active ? active.name : "Todos os clientes"}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-40 w-full sm:w-[280px] overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-xl">
          <label className="flex items-center gap-2 border-b border-[#EEF0F3] px-3 py-2.5 text-[#667085]">
            <Search size={15} aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente..."
              aria-label="Buscar cliente"
              className="h-6 flex-1 !border-0 bg-transparent text-sm !shadow-none outline-none"
            />
          </label>
          <ul role="listbox" className="max-h-[300px] overflow-y-auto p-1.5">
            <li role="option" aria-selected={!activeClientId}>
              <button
                type="button"
                onClick={() => choose(undefined)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[#101828] hover:bg-[#F2F4F7]"
              >
                Todos os clientes
                {!activeClientId && <Check size={15} aria-hidden />}
              </button>
            </li>
            {filtered.map((client) => (
              <li key={client.id} role="option" aria-selected={client.id === activeClientId}>
                <button
                  type="button"
                  onClick={() => choose(client.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[#344054] hover:bg-[#F2F4F7]"
                >
                  <span className="truncate">{client.name}</span>
                  {client.id === activeClientId && <Check size={15} className="shrink-0" aria-hidden />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2.5 py-3 text-center text-xs text-[#98A2B3]">Nenhum cliente encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
