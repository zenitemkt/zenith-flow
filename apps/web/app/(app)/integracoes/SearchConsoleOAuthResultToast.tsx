"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

const ERROR_MESSAGES: Record<string, string> = {
  authorization_denied: "Autorização cancelada no Google.",
  invalid_state: "Sessão de conexão expirada — tente conectar de novo.",
  missing_code: "O Google não retornou o código de autorização.",
  agency_not_found: "Agência não encontrada.",
  no_refresh_token: "O Google não devolveu permissão permanente — tente conectar de novo.",
  site_not_found: "Nenhuma propriedade do hubzenite.com.br encontrada nesse login do Google.",
  google_api_error: "Erro ao falar com o Google — tente novamente em instantes.",
};

/** Mostra o resultado do redirect de volta do Search Console (`?gsc=connected|error`) e limpa a URL. */
export function SearchConsoleOAuthResultToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  useEffect(() => {
    const result = searchParams.get("gsc");
    if (!result) return;

    if (result === "connected") {
      toast.success("Search Console conectado.");
    } else if (result === "error") {
      const reason = searchParams.get("reason") ?? "";
      toast.error(ERROR_MESSAGES[reason] ?? "Não foi possível conectar o Search Console.");
    }

    router.replace("/integracoes?tab=conteudo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
