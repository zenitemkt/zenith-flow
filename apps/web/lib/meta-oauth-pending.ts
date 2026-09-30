import { encryptSecret, decryptSecret } from "@/lib/crypto-secrets";
import type { MetaAdAccount } from "@/lib/meta-ads";

/**
 * Estado transitório entre o callback do OAuth da Meta e a escolha de conta
 * (seção 38 — quando `/me/adaccounts` devolve mais de uma conta, porque a
 * Zenite administra contas de cliente pela própria conta pessoal do usuário
 * que autorizou, não só a conta da própria agência). Guardado num cookie
 * httpOnly assinado/cifrado (mesmo `encryptSecret` do cofre de credenciais —
 * GCM já detecta adulteração), nunca no banco: se o usuário nunca escolher,
 * não sobra nenhum vestígio além do cookie expirar sozinho.
 */
export const META_OAUTH_PENDING_COOKIE = "meta_oauth_pending";
export const META_OAUTH_PENDING_TTL_SECONDS = 600; // 10 minutos — tempo de sobra pra escolher, sem deixar o token solto por muito tempo

export interface MetaOAuthPendingState {
  agencyId: string;
  connectedByUserId: string | null;
  accessToken: string;
  tokenExpiresAt: string | null; // ISO date ou null
  candidates: MetaAdAccount[];
}

export function encodeMetaOAuthPending(state: MetaOAuthPendingState): string {
  return encryptSecret(JSON.stringify(state));
}

export function decodeMetaOAuthPending(cookieValue: string): MetaOAuthPendingState | null {
  try {
    const parsed = JSON.parse(decryptSecret(cookieValue)) as MetaOAuthPendingState;
    if (!parsed.agencyId || !parsed.accessToken || !Array.isArray(parsed.candidates)) return null;
    return parsed;
  } catch {
    return null;
  }
}
