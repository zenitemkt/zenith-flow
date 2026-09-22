"use client";

import { useState } from "react";
import { Modal } from "@zenite-mkt/ui";

interface Props {
  proposalId: string;
  open: boolean;
  onClose: () => void;
  defaultEmail?: string | null;
  defaultWhatsapp?: string | null;
  onSent?: () => void;
}

type ChannelStatus = "idle" | "loading" | "done" | "error";

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Popup de envio reutilizado logo após criar a proposta (redirect com
 * `?send=1`) e depois, a qualquer momento, pelo botão "Enviar proposta" no
 * detalhe. E-mail e WhatsApp são independentes — mandar por um não fecha o
 * popup nem impede mandar pelo outro em seguida; "Fechar" também é uma saída
 * válida (proposta pode só ser visualizada/impressa, sem envio nenhum).
 */
export function SendProposalModal({ proposalId, open, onClose, defaultEmail, defaultWhatsapp, onSent }: Props) {
  const [to, setTo] = useState(defaultEmail ?? "");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [emailStatus, setEmailStatus] = useState<ChannelStatus>("idle");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const [phone, setPhone] = useState(defaultWhatsapp ?? "");
  const [waStatus, setWaStatus] = useState<ChannelStatus>("idle");
  const [waMessage, setWaMessage] = useState<string | null>(null);

  async function handleSendEmail() {
    setEmailStatus("loading");
    setEmailMessage(null);
    const response = await fetch(`/api/proposals/${proposalId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, cc: cc || undefined, bcc: bcc || undefined }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setEmailStatus("error");
      setEmailMessage(body?.error ?? "Não foi possível enviar o e-mail.");
      return;
    }
    setEmailStatus("done");
    setEmailMessage(`Enviado às ${timeLabel(new Date())}`);
    onSent?.();
  }

  async function handleSendWhatsapp() {
    setWaStatus("loading");
    setWaMessage(null);
    const response = await fetch(`/api/proposals/${proposalId}/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setWaStatus("error");
      setWaMessage(body?.error ?? "Não foi possível gerar o link do WhatsApp.");
      return;
    }
    window.open(body.waLink, "_blank");
    setWaStatus("done");
    setWaMessage("Marcado como enviado ✓");
    onSent?.();
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar proposta" description="Por e-mail, WhatsApp, ou os dois — sem fechar entre um e outro.">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2 rounded-xl border border-[#E4E7EC] p-3">
          <h3 className="text-sm font-semibold text-[#101828]">E-mail</h3>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="cliente@empresa.com"
            className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
          />
          {showCcBcc ? (
            <div className="flex flex-col gap-2">
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="CC (separado por vírgula)"
                className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
              <input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="CCO (separado por vírgula)"
                className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className="self-start text-xs font-medium text-[#475467] underline hover:text-[#101828]"
            >
              + Adicionar CC/CCO
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={emailStatus === "loading" || !to.includes("@")}
              onClick={() => void handleSendEmail()}
              className="flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#FF2B00" }}
            >
              {emailStatus === "loading" ? "Enviando..." : "Enviar e-mail"}
            </button>
            {emailMessage && (
              <span className={`text-xs font-medium ${emailStatus === "error" ? "text-[#D94343]" : "text-[#166534]"}`}>
                {emailMessage}
              </span>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-[#E4E7EC] p-3">
          <h3 className="text-sm font-semibold text-[#101828]">WhatsApp</h3>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 91234-5678"
            className="h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#FF2B00]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={waStatus === "loading" || phone.trim().length < 8}
              onClick={() => void handleSendWhatsapp()}
              className="flex h-9 items-center justify-center rounded-lg border border-[#16A36A] px-3 text-sm font-semibold text-[#16A36A] hover:bg-[#DCFCE7] disabled:opacity-60"
            >
              {waStatus === "loading" ? "Gerando link..." : "Abrir WhatsApp"}
            </button>
            {waMessage && (
              <span className={`text-xs font-medium ${waStatus === "error" ? "text-[#D94343]" : "text-[#166534]"}`}>
                {waMessage}
              </span>
            )}
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium text-[#475467] hover:bg-[#F6F7FB]"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
