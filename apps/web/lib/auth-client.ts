import { createAuthClient } from "better-auth/react";

/**
 * Sem `baseURL` fixo de propósito: como a sessão/cookie é por host (não por
 * domínio raiz — ver docs/DECISIONS.md, "Portal por subdomínio"), o pedido de
 * login precisa ir pro `/api/auth` do MESMO host que serviu a página. Fixar
 * `NEXT_PUBLIC_APP_URL` aqui fazia login em portal.hubzenite.com.br virar uma
 * chamada cross-origin pro domínio principal, que o Better Auth rejeita por
 * checagem de origem — aparecia pro usuário como "e-mail ou senha inválidos",
 * mascarando o erro real (bug encontrado em 2026-09-24).
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword } = authClient;
