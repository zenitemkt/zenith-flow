import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Proteção CSRF do fluxo OAuth (Meta hoje, Google Ads depois — mesmo
 * mecanismo). O `state` devolvido pela plataforma externa precisa provar
 * duas coisas: (1) que a autorização começou aqui mesmo, não foi forjada por
 * outro site; (2) qual agência iniciou, sem confiar em nada que volte
 * decodificável só pelo cliente. Assinado com HMAC-SHA256 usando
 * `BETTER_AUTH_SECRET` (reaproveitado — é exatamente esse tipo de segredo de
 * assinatura de curta duração, não precisa de uma chave própria nova).
 */

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos — tempo de sobra pra completar o diálogo da Meta.

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET não configurada.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

/** `agencyId` + nonce aleatório + timestamp, tudo assinado — formato: `<payload base64url>.<assinatura>`. */
export function createOAuthState(agencyId: string): string {
  const payload = JSON.stringify({ agencyId, nonce: randomBytes(12).toString("hex"), issuedAt: Date.now() });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Verifica assinatura e validade (TTL); devolve `agencyId` só quando tudo bate. */
export function verifyOAuthState(state: string | null | undefined): { agencyId: string } | null {
  if (!state) return null;
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      agencyId?: unknown;
      issuedAt?: unknown;
    };
    if (typeof payload.agencyId !== "string" || typeof payload.issuedAt !== "number") return null;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;
    return { agencyId: payload.agencyId };
  } catch {
    return null;
  }
}
