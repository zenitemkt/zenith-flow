import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = "https://graph.facebook.com/v23.0";

function token() {
  const value = process.env.ASSISTANT_WA_TOKEN;
  if (!value) throw new Error("ASSISTANT_WA_TOKEN ausente.");
  return value;
}

function phoneNumberId() {
  const value = process.env.ASSISTANT_WA_PHONE_NUMBER_ID;
  if (!value) throw new Error("ASSISTANT_WA_PHONE_NUMBER_ID ausente.");
  return value;
}

export function verifyWhatsappSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.ASSISTANT_WA_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(header.slice(7), "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function post(payload: Record<string, unknown>): Promise<string | null> {
  const response = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WhatsApp ${response.status}: ${JSON.stringify(data?.error ?? data).slice(0, 300)}`);
  return data?.messages?.[0]?.id ?? null;
}

export function sendText(to: string, body: string) {
  return post({ to, type: "text", text: { body, preview_url: true } });
}

export function sendButtons(to: string, body: string, buttons: { id: string; title: string }[]) {
  return post({
    to,
    type: "interactive",
    interactive: { type: "button", body: { text: body }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) } },
  });
}

/** Mensagem para grupo (API de grupos da Meta). Pode não estar disponível: quem chama trata o erro. */
export function sendGroupText(groupId: string, body: string) {
  return post({ recipient_type: "group", to: groupId, type: "text", text: { body } });
}

/** Modelo aprovado, usado quando a janela de 24 h da conversa já fechou. */
export function sendTemplate(to: string, name: string, params: string[]) {
  return post({
    to,
    type: "template",
    template: { name, language: { code: "pt_BR" }, components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [] },
  });
}

export async function downloadMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string }> {
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());
  if (!meta?.url) throw new Error("Mídia sem URL.");
  const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!file.ok) throw new Error(`Download da mídia falhou: ${file.status}`);
  return { data: Buffer.from(await file.arrayBuffer()), mimeType: meta.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream" };
}

export async function transcribeAudio(data: Buffer, mimeType: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY ausente.");
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("mp4") ? "m4a" : "ogg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: mimeType }), `audio.${ext}`);
  form.append("model", process.env.TRANSCRIPTION_MODEL || "whisper-1");
  form.append("language", "pt");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Transcrição falhou: ${response.status}`);
  return String(result.text ?? "").trim();
}
