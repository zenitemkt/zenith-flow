"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Enquanto houver busca no Apify, importa o que terminar e atualiza a lista (em qualquer aba). */
export function PendingSearchWatcher() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch("/api/prospecting/search/check", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (body && (body.created > 0 || body.pending === 0)) router.refresh();
    }, 20_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
