"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@zenite-mkt/ui";

const ERROR_MESSAGES: Record<string, string> = {
  authorization_denied: "Autorização cancelada na Meta.",
  invalid_state: "Sessão de conexão expirada — tente conectar de novo.",
  missing_code: "A Meta não retornou o código de autorização.",
  agency_not_found: "Agência não encontrada.",
  no_ad_account: "Nenhuma conta de anúncio encontrada nesse login da Meta.",
  meta_api_error: "Erro ao falar com a Meta — tente novamente em instantes.",
};

/** Mostra o resultado do redirect de volta da Meta (`?meta=connected|error`) e limpa a URL, pra não repetir num refresh. */
export function MetaOAuthResultToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  useEffect(() => {
    const result = searchParams.get("meta");
    if (!result) return;

    // "choose_account" não é um resultado final — a própria página ainda precisa do
    // parâmetro pra saber que deve mostrar o seletor de conta (ChooseMetaAccountForm),
    // então não limpa a URL nem mostra toast aqui.
    if (result === "choose_account") return;

    if (result === "connected") {
      toast.success("Conta da Meta conectada.");
    } else if (result === "error") {
      const reason = searchParams.get("reason") ?? "";
      toast.error(ERROR_MESSAGES[reason] ?? "Não foi possível conectar a conta da Meta.");
    }

    router.replace("/traqueamento/conexoes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
