"use client";

import { DIRECT_UPLOAD_THRESHOLD_BYTES } from "@/lib/content-media";
import { formatBytes } from "@/lib/media";

/**
 * Envio da arte de uma peça a partir do navegador. Usado pela "Nova versão"
 * do cartão e pelo agendamento direto no Calendário.
 */
export interface UploadedMedia {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Folga abaixo do limite do servidor (o multipart soma alguns bytes). */
const IMAGE_TARGET_BYTES = DIRECT_UPLOAD_THRESHOLD_BYTES - 200 * 1024;
/** Lado maior da imagem publicada: sobra para o Instagram (1080/1440) e o Facebook (2048). */
const IMAGE_MAX_SIDE = 2160;

function encodeJpeg(bitmap: ImageBitmap, scale: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  // Fundo branco onde houver transparência (PNG/WEBP).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * O Instagram só aceita JPEG e o servidor só recebe até ~4MB: toda imagem que
 * não for um JPEG já pequeno é convertida, reduzida e comprimida aqui. Assim
 * imagem nunca depende do envio direto ao R2 (que exige CORS no bucket).
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const fitsAsIs =
    file.type === "image/jpeg" && file.size <= IMAGE_TARGET_BYTES && Math.max(bitmap.width, bitmap.height) <= IMAGE_MAX_SIDE;
  if (fitsAsIs) {
    bitmap.close();
    return file;
  }

  let scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const quality = Math.max(0.6, 0.92 - (attempt % 4) * 0.1);
    blob = await encodeJpeg(bitmap, scale, quality);
    if (!blob || blob.size <= IMAGE_TARGET_BYTES) break;
    // Depois de baixar a qualidade algumas vezes, reduz o tamanho.
    if (attempt % 4 === 3) scale *= 0.8;
  }
  bitmap.close();
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Sobe um arquivo pra peça: até ~4MB vai pelo servidor; maior (vídeo) vai
 * direto pro R2 com URL assinada. Devolve o que a criação da versão precisa.
 */
export async function uploadContentMedia(contentId: string, original: File): Promise<UploadedMedia> {
  const file = await prepareImageForUpload(original);
  const base = { fileName: file.name, contentType: file.type, sizeBytes: file.size };

  if (file.size <= DIRECT_UPLOAD_THRESHOLD_BYTES) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/content/${contentId}/media-upload`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `Não foi possível enviar "${file.name}".`);
    return { ...base, key: body.key };
  }

  const res = await fetch(`/api/content/${contentId}/media-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(base),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Não foi possível preparar o envio de "${file.name}".`);

  const put = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }).catch(() => null);
  if (!put || !put.ok) {
    throw new Error(
      `Não foi possível enviar "${file.name}" (${formatBytes(file.size)}). Vídeos acima de 4MB precisam do CORS liberado no armazenamento — avise o administrador.`,
    );
  }
  return { ...base, key: body.key };
}
