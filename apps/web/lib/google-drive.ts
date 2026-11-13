import { createSign } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Google Drive por conta de serviço (sem login de usuário): o sistema só enxerga as pastas
 * que alguém compartilhar com o e-mail da conta de serviço. Credencial em `GOOGLE_DRIVE_SA_JSON`
 * (o JSON da chave, puro ou em base64). Usado pela biblioteca de criativos do Gestor de tráfego.
 */
const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_DRIVE_SA_JSON?.trim();
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")) as Partial<ServiceAccount>;
    if (!json.client_email || !json.private_key) return null;
    return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function driveServiceAccountEmail(): string | null {
  return serviceAccount()?.client_email ?? null;
}

let cached: { token: string; expiresAt: number } | null = null;

/**
 * Token de um usuário Google (quando a agência conectou a própria conta) para as chamadas feitas
 * dentro de `runWithDriveUserToken`. A conta de serviço não tem espaço no Drive e não pode CRIAR
 * arquivos em Drive pessoal; com o token do usuário o arquivo fica dele.
 */
const userToken = new AsyncLocalStorage<string>();
export function runWithDriveUserToken<T>(token: string | null, fn: () => Promise<T>): Promise<T> {
  return token ? userToken.run(token, fn) : fn();
}

async function accessToken(): Promise<string> {
  const fromUser = userToken.getStore();
  if (fromUser) return fromUser;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  if (!sa) throw new Error("Google Drive não configurado (GOOGLE_DRIVE_SA_JSON ausente ou inválido).");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`Login da conta de serviço do Google falhou (${response.status}).`);
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function drive<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message ?? `erro ${response.status}`;
    throw new DriveError(response.status === 404 ? "Pasta ou arquivo não encontrado. Confira se foi compartilhado com o e-mail do sistema." : `Google Drive: ${message}`, response.status);
  }
  return data as T;
}

export class DriveError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  imageMediaMetadata?: { width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number };
  thumbnailLink?: string;
  capabilities?: { canEdit?: boolean; canAddChildren?: boolean };
}

const FILE_FIELDS = "id,name,mimeType,size,parents,imageMediaMetadata(width,height),videoMediaMetadata(width,height),thumbnailLink,capabilities(canEdit,canAddChildren)";

/** Aceita o link da pasta ou só o ID. */
export function parseDriveFolderId(input: string): string | null {
  const value = input.trim();
  const match = value.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? value.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (match) return match[1]!;
  return /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : null;
}

export function getDriveFile(id: string) {
  return drive<DriveFile>(`/files/${id}?fields=${encodeURIComponent(FILE_FIELDS)}&supportsAllDrives=true`);
}

export async function listDriveChildren(folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await drive<{ files?: DriveFile[]; nextPageToken?: string }>(`/files?${query.toString()}`);
    out.push(...(page.files ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export const isDriveFolder = (file: DriveFile) => file.mimeType === FOLDER_MIME;

export function createDriveFolder(name: string, parentId: string) {
  return drive<DriveFile>(`/files?supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`, { method: "POST", body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }) });
}

export function moveDriveFile(fileId: string, fromFolderId: string, toFolderId: string) {
  const query = new URLSearchParams({ addParents: toFolderId, removeParents: fromFolderId, supportsAllDrives: "true", fields: "id,parents" });
  return drive<DriveFile>(`/files/${fileId}?${query.toString()}`, { method: "PATCH", body: "{}" });
}

/** Conteúdo do arquivo (para miniatura própria ou envio à Meta). */
export async function downloadDriveFile(fileId: string): Promise<Response> {
  const response = await fetch(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!response.ok) throw new DriveError(`Não consegui baixar o arquivo do Drive (${response.status}).`, response.status);
  return response;
}

/** Miniatura gerada pelo Drive (imagem e vídeo). `null` quando o Drive ainda não gerou. */
export async function fetchDriveThumbnail(fileId: string, size = 480): Promise<Response | null> {
  const file = await getDriveFile(fileId);
  if (!file.thumbnailLink) return null;
  const url = file.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  return response.ok ? response : null;
}

/**
 * Abre uma sessão de envio "retomável" no Drive e devolve o endereço para o NAVEGADOR mandar o
 * arquivo direto ao Google (não passa pelo servidor, que tem limite de ~4 MB por requisição).
 * O `origin` libera o envio do navegador (CORS) a partir do portal.
 */
export async function createDriveResumableUpload(input: { name: string; mimeType: string; size: number; parentId: string; origin: string }): Promise<string> {
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.mimeType,
      "X-Upload-Content-Length": String(input.size),
      Origin: input.origin,
    },
    body: JSON.stringify({ name: input.name, parents: [input.parentId] }),
  });
  const location = response.headers.get("location");
  if (!response.ok || !location) {
    const data = await response.json().catch(() => ({}));
    throw new DriveError(`Google Drive: não consegui abrir o envio (${(data as { error?: { message?: string } })?.error?.message ?? response.status}).`, response.status);
  }
  return location;
}
