import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lib/r2";

/** Server-only. Toda arte de conteúdo fica sob este prefixo — a criação da versão confere que a chave é deste item. */
export function contentMediaPrefix(agencyId: string, contentItemId: string): string {
  return `${agencyId}/content/${contentItemId}/`;
}

export function buildContentMediaKey(agencyId: string, contentItemId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `${contentMediaPrefix(agencyId, contentItemId)}${randomUUID()}-${safeName}`;
}

/** URL pra o navegador subir direto (PUT) — precisa de CORS liberado no bucket. */
export async function signContentMediaUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn: 15 * 60,
  });
}

export async function putContentMedia(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

/**
 * URL de leitura assinada. Para exibir na tela, 5 minutos bastam; a Meta
 * baixa a mídia ao publicar e pode demorar (vídeo), então ali usamos 2h.
 */
export async function signContentMediaRead(key: string, expiresInSeconds = 300): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}
