const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GOOGLE_BUSINESS_SCOPES = [GOOGLE_BUSINESS_SCOPE, "openid", "email"] as const;

function requireEnv(name: "GOOGLE_BUSINESS_CLIENT_ID" | "GOOGLE_BUSINESS_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada.`);
  return value;
}

function appUrl(): string {
  return process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.hubzenite.com.br";
}

export function googleBusinessConfigured(): boolean {
  return Boolean(process.env.GOOGLE_BUSINESS_CLIENT_ID?.trim() && process.env.GOOGLE_BUSINESS_CLIENT_SECRET?.trim());
}

export function getGoogleBusinessRedirectUri(): string {
  return `${appUrl()}/api/integrations/google-business/callback`;
}

export function buildGoogleBusinessAuthorizeUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requireEnv("GOOGLE_BUSINESS_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getGoogleBusinessRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_BUSINESS_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export async function exchangeGoogleBusinessCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"), client_secret: requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET"), redirect_uri: getGoogleBusinessRedirectUri(), grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error(`O Google recusou a troca do código (${response.status}).`);
  return await response.json() as { access_token: string; refresh_token?: string; scope?: string; expires_in?: number };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const body = await response.json() as { email?: string };
  return body.email ?? null;
}
