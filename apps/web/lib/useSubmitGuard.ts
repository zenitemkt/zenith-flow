"use client";

import { useRef } from "react";

/**
 * Trava síncrona contra duplo clique/toque em formulários de criação — ver
 * docs/DECISIONS.md (2026-09-24, "card duplicado em Operação"). `disabled`
 * no botão sozinho não basta: o React só aplica o atributo no próximo
 * render, e dois cliques bem rápidos (toque duplo no celular, conexão
 * lenta) podem disparar o mesmo `handleSubmit` duas vezes antes disso.
 * `guardSubmit(fn)` ignora qualquer chamada que aconteça enquanto a
 * anterior ainda está em voo — uma ref muda na hora, sem esperar re-render.
 */
export function useSubmitGuard() {
  const submittingRef = useRef(false);

  return async function guardSubmit(fn: () => Promise<void>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await fn();
    } finally {
      submittingRef.current = false;
    }
  };
}
