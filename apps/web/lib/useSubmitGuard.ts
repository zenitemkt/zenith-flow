"use client";

import { useRef } from "react";

/** Depois de terminar, a trava ainda segura por este tempo (clique duplo logo após concluir). */
export const SUBMIT_COOLDOWN_MS = 1000;

/**
 * Trava síncrona contra duplo clique/toque em formulários de criação — ver
 * docs/DECISIONS.md (2026-09-24, "card duplicado em Operação"). `disabled`
 * no botão sozinho não basta: o React só aplica o atributo no próximo
 * render, e dois cliques bem rápidos (toque duplo no celular, conexão
 * lenta) podem disparar o mesmo `handleSubmit` duas vezes antes disso.
 * `guardSubmit(fn)` ignora qualquer chamada que aconteça enquanto a
 * anterior ainda está em voo e por mais `SUBMIT_COOLDOWN_MS` depois que ela
 * termina — uma ref muda na hora, sem esperar re-render. Coloque dentro de
 * `fn` também a janela de confirmação, se houver: senão um duplo clique abre
 * duas confirmações e cada uma cria um registro (2026-11-17).
 */
export function useSubmitGuard() {
  const submittingRef = useRef(false);

  return async function guardSubmit(fn: () => Promise<void>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await fn();
    } finally {
      setTimeout(() => {
        submittingRef.current = false;
      }, SUBMIT_COOLDOWN_MS);
    }
  };
}
