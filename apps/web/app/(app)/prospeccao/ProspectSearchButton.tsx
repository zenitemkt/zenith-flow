"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { alertDialog } from "@/lib/dialogs";

const POLL_MS = 15_000;

/** Dispara a busca e acompanha o Apify até terminar (importa o que for ficando pronto). */
export function ProspectSearchButton({ pending, ready }: { pending: number; ready: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(pending > 0);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    let created = 0;
    let skipped = 0;
    const timer = setInterval(async () => {
      const res = await fetch("/api/prospecting/search/check", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) return;
      created += body.created ?? 0;
      skipped += body.skipped ?? 0;
      if (body.created > 0 || body.pending === 0) router.refresh();
      if (body.pending === 0) {
        setRunning(false);
        setSummary(`${created} empresa(s) nova(s), ${skipped} repetida(s) ou já conhecida(s).`);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, router]);

  async function start() {
    setBusy(true);
    setSummary(null);
    const res = await fetch("/api/prospecting/search", { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return void alertDialog(body?.error ?? "Não foi possível iniciar a busca.", { title: "Não buscou" });
    setRunning(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!ready || busy || running}
        onClick={() => void start()}
        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#FF2B00] px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Search size={16} aria-hidden /> {running ? "Buscando no Google Maps..." : busy ? "Iniciando..." : "Buscar leads"}
      </button>
      {!ready && <p className="text-[11px] text-[#667085]">Salve pelo menos um nicho, uma cidade e a chave do Apify.</p>}
      {running && <p className="text-[11px] text-[#667085]">Pode sair da página: a busca continua e o resultado entra na próxima vez que você abrir.</p>}
      {summary && <p className="text-[11px] font-medium text-[#027A48]">{summary}</p>}
    </div>
  );
}
