import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import { googleClient } from "@/lib/assistant/calendar";
import { runWithDriveUserToken } from "@/lib/google-drive";

/** Troca o refresh token da conta Google conectada no Gestor de tráfego por um token de acesso. */
async function agencyDriveToken(agencyId: string): Promise<string | null> {
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId }, select: { driveRefreshTokenEnc: true } });
  if (!settings?.driveRefreshTokenEnc) return null;
  const { id, secret } = googleClient();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: decryptSecret(settings.driveRefreshTokenEnc), grant_type: "refresh_token" }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("A conta Google do Drive desconectou. Conecte de novo no Gestor de tráfego.");
  return data.access_token as string;
}

/** Roda `fn` usando a conta Google da agência no Drive (ou a conta de serviço, se não houver). */
export async function withAgencyDrive<T>(agencyId: string, fn: () => Promise<T>): Promise<T> {
  return runWithDriveUserToken(await agencyDriveToken(agencyId), fn);
}

export async function agencyHasDriveUser(agencyId: string): Promise<boolean> {
  const settings = await prisma.trafficSettings.findUnique({ where: { agencyId }, select: { driveRefreshTokenEnc: true } });
  return Boolean(settings?.driveRefreshTokenEnc);
}
