import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 fala a API do S3 — o único ajuste necessário é
 * `forcePathStyle: true` (R2 exige path-style, não virtual-hosted-style).
 * Bucket privado por padrão: nunca expomos a URL do objeto direto, só
 * URLs assinadas de curta duração (ver lib/media.ts).
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  // AWS SDK v3 recente calcula checksum CRC32 por padrão e assina a
  // requisição incluindo esse header — R2 não suporta isso e responde
  // "SignatureDoesNotMatch". Incompatibilidade conhecida entre SDK novo e R2.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
