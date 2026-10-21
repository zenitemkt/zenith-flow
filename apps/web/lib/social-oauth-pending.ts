import { decryptSecret, encryptSecret } from "@/lib/crypto-secrets";

/**
 * Entre o retorno do OAuth e a escolha da Página do cliente, o token de
 * usuário (longa duração) fica só num cookie httpOnly cifrado — nunca no
 * banco. As Páginas são buscadas de novo na hora de mostrar/salvar, pra o
 * cookie não estourar o limite de ~4KB quando a agência administra muitas.
 */
export const SOCIAL_OAUTH_PENDING_COOKIE = "social_oauth_pending";
export const SOCIAL_OAUTH_PENDING_TTL_SECONDS = 15 * 60;

export interface SocialOAuthPending {
  agencyId: string;
  clientId: string;
  userId: string;
  userAccessToken: string;
}

export function encodeSocialOAuthPending(state: SocialOAuthPending): string {
  return encryptSecret(JSON.stringify(state));
}

export function decodeSocialOAuthPending(value: string | undefined): SocialOAuthPending | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decryptSecret(value)) as SocialOAuthPending;
    if (!parsed.agencyId || !parsed.clientId || !parsed.userId || !parsed.userAccessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}
