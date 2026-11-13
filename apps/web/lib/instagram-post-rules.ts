import { prisma } from "@zenite-mkt/db";
import { isSafeHttpUrl } from "@/lib/instagram-flow-model";

/**
 * Mini-chat definido na tela de agendamento do post. Como o post ainda não existe no Instagram,
 * a regra nasce inativa e sem mediaId, presa ao SocialPost. Quando o post é publicado,
 * `activatePendingPostRules` grava o mediaId e liga a regra (assim ela só vale para aquele post,
 * nunca para todos).
 */
export interface MiniChatInput {
  keyword: string;
  responseText: string;
  publicReplyTexts: string[];
  buttons: { text: string; url: string }[];
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** null = mini-chat não pedido; string = erro de validação. */
export function parseMiniChatInput(value: unknown): MiniChatInput | string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.enabled !== true) return null;
  const keyword = clean(v.keyword, 100);
  const responseText = clean(v.responseText, 1000);
  if (!keyword) return "Mini-chat: informe a palavra-chave.";
  if (!responseText) return "Mini-chat: escreva a mensagem que vai no direct.";
  const publicReplyTexts = Array.isArray(v.publicReplyTexts)
    ? v.publicReplyTexts.map((t) => clean(t, 300)).filter(Boolean).slice(0, 20)
    : [];
  const rawButtons = Array.isArray(v.buttons) ? v.buttons : [];
  const buttons: { text: string; url: string }[] = [];
  for (const b of rawButtons) {
    if (!b || typeof b !== "object") continue;
    const text = clean((b as Record<string, unknown>).text, 20);
    const url = clean((b as Record<string, unknown>).url, 500);
    if (!text && !url) continue;
    if (!text || !url || !isSafeHttpUrl(url)) return "Mini-chat: cada botão precisa de texto (até 20 letras) e um link começando com https://.";
    buttons.push({ text, url });
  }
  return { keyword, responseText, publicReplyTexts, buttons: buttons.slice(0, 3) };
}

export async function createPendingPostRule(input: { agencyId: string; clientId: string; socialPostId: string; caption: string; miniChat: MiniChatInput }) {
  return prisma.instagramAutomationRule.create({
    data: {
      agencyId: input.agencyId,
      clientId: input.clientId,
      triggerType: "comment",
      keyword: input.miniChat.keyword,
      responseText: input.miniChat.responseText,
      buttons: input.miniChat.buttons,
      publicReplyTexts: input.miniChat.publicReplyTexts,
      mediaCaption: input.caption ? input.caption.slice(0, 300) : null,
      socialPostId: input.socialPostId,
      active: false,
    },
  });
}

/** Chamado quando o post sai no Instagram: liga as regras que esperavam por ele. Nunca lança erro. */
export async function activatePendingPostRules(socialPostId: string, mediaId: string | null, permalink: string | null) {
  if (!mediaId) return;
  try {
    await prisma.instagramAutomationRule.updateMany({
      where: { socialPostId, mediaId: null },
      data: { mediaId, mediaPermalink: permalink, active: true },
    });
  } catch (error) {
    console.error("instagram_post_rule_activate_failed", socialPostId, error);
  }
}
