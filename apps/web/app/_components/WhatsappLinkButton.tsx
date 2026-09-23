"use client";

import { buildWhatsappLink, buildWhatsappMessage } from "@/lib/whatsapp";

/**
 * Link manual de WhatsApp por linha (NPS/eNPS) — sem estado de "enviado":
 * é o usuário quem decide mandar ou não, um contato por vez, então não faz
 * sentido rastrear isso como uma transição de status.
 *
 * `path` é relativo (ex.: "/pesquisa/token") — a origem é resolvida em
 * tempo de clique (`window.location.origin`), nunca durante o render do
 * servidor, mesmo padrão já usado em `CopyLinkButton`.
 */
export function WhatsappLinkButton({ phone, intro, path }: { phone: string; intro: string; path: string }) {
  function handleClick() {
    const url = `${window.location.origin}${path}`;
    window.open(buildWhatsappLink(phone, buildWhatsappMessage(intro, url)), "_blank");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-7 items-center justify-center rounded-md border border-[#16A36A] px-2 text-xs font-medium text-[#16A36A] hover:bg-[#DCFCE7]"
    >
      WhatsApp
    </button>
  );
}
