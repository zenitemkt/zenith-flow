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

export async function refreshGoogleBusinessAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"), client_secret: requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET"), grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error(`O Google recusou a renovação do acesso (${response.status}). Reconecte o Google Meu Negócio.`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("O Google não devolveu uma credencial de acesso válida.");
  return body.access_token;
}

import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";

/** Troca o refresh token da agência por um access token válido na hora. */
export async function withGoogleBusinessToken<T>(agencyId: string, fn: (accessToken: string) => Promise<T>): Promise<T> {
  const connection = await prisma.googleBusinessConnection.findUnique({ where: { agencyId } });
  if (!connection || connection.status !== "ACTIVE") throw new Error("Conecte a conta do Google Meu Negócio em Integrações antes de vincular um cliente.");
  const accessToken = await refreshGoogleBusinessAccessToken(decryptSecret(connection.refreshTokenEnc));
  return fn(accessToken);
}

export interface GoogleBusinessLocationOption {
  accountId: string;
  locationId: string;
  name: string;
  address: string | null;
}

/** Contas e localizações que a conta conectada do Google administra. */
export async function listGoogleBusinessLocations(accessToken: string): Promise<GoogleBusinessLocationOption[]> {
  const accountsRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!accountsRes.ok) throw new Error(`O Google recusou listar as contas (${accountsRes.status}).`);
  const accountsBody = (await accountsRes.json()) as { accounts?: { name: string }[] };
  const options: GoogleBusinessLocationOption[] = [];
  for (const account of accountsBody.accounts ?? []) {
    const readMask = "name,title,storefrontAddress";
    let pageToken: string | undefined;
    do {
      const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
      url.searchParams.set("readMask", readMask);
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const locationsRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!locationsRes.ok) break;
      const locationsBody = (await locationsRes.json()) as {
        locations?: { name: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string } }[];
        nextPageToken?: string;
      };
      for (const location of locationsBody.locations ?? []) {
        const address = location.storefrontAddress ? [...(location.storefrontAddress.addressLines ?? []), location.storefrontAddress.locality].filter(Boolean).join(", ") : null;
        options.push({ accountId: account.name, locationId: location.name, name: location.title ?? location.name, address });
      }
      pageToken = locationsBody.nextPageToken;
    } while (pageToken);
  }
  return options;
}

export function googleBusinessLocationParent(accountId: string, locationId: string): string {
  if (locationId.startsWith("accounts/")) return locationId;
  const account = accountId.startsWith("accounts/") ? accountId : `accounts/${accountId}`;
  const location = locationId.startsWith("locations/") ? locationId : `locations/${locationId}`;
  return `${account}/${location}`;
}

export interface GoogleBusinessLocalPostInput {
  parent: string;
  summary: string;
  mediaUrl?: string | null;
  /** Vídeo: até 30s e ~75MB (limite do Google). Passa `mediaFormat: VIDEO` em vez de PHOTO. */
  mediaIsVideo?: boolean;
  callToAction?: string | null;
  callToActionUrl?: string | null;
}

export async function publishGoogleBusinessLocalPost(accessToken: string, input: GoogleBusinessLocalPostInput) {
  const callToAction = input.callToAction
    ? { actionType: input.callToAction, ...(input.callToAction === "CALL" ? {} : { url: input.callToActionUrl }) }
    : undefined;
  const response = await fetch(`https://mybusiness.googleapis.com/v4/${input.parent}/localPosts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      languageCode: "pt-BR",
      summary: input.summary,
      topicType: "STANDARD",
      ...(input.mediaUrl ? { media: [{ mediaFormat: input.mediaIsVideo ? "VIDEO" : "PHOTO", sourceUrl: input.mediaUrl }] } : {}),
      ...(callToAction ? { callToAction } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`O Google recusou a publicação (${response.status})${detail ? `: ${detail.slice(0, 240)}` : "."}`);
  }
  return await response.json() as { name?: string; searchUrl?: string };
}
