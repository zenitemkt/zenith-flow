"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 60_000;

/**
 * Rede de segurança do agendador de redes: enquanto alguém da equipe está com
 * o sistema aberto (aba visível), pede ao servidor a cada minuto para publicar
 * o que venceu. O cron externo continua sendo quem garante o horário com o
 * sistema fechado. Não renderiza nada.
 */
export function SocialPublishTicker() {
  const router = useRouter();

  useEffect(() => {
    let running = false;
    let stopped = false;

    async function tick() {
      if (running || stopped || document.visibilityState !== "visible") return;
      running = true;
      try {
        const res = await fetch("/api/social/publish-due", { method: "POST" });
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as Record<string, number> | null;
        const changed = (body?.published ?? 0) + (body?.failed ?? 0) + (body?.processing ?? 0) + (body?.retried ?? 0);
        if (changed > 0 && !stopped) router.refresh();
      } catch {
        // Sem rede: tenta de novo no próximo minuto.
      } finally {
        running = false;
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), INTERVAL_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
