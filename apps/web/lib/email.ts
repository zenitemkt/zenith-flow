import { Resend } from "resend";
import type { Proposal } from "@zenite-mkt/db";
import { formatProposalValue } from "./proposals";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Resend não configurado ainda — defina RESEND_API_KEY e RESEND_FROM_EMAIL no ambiente.");
    this.name = "EmailNotConfiguredError";
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function proposalEmailHtml(proposal: Proposal, publicUrl: string, agencyName: string): string {
  const value = proposal.valueCents !== null ? formatProposalValue(proposal.valueCents) : null;
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #101828;">
      <p>Olá!</p>
      <p>${agencyName} enviou uma proposta comercial pra você: <strong>${proposal.name}</strong>.</p>
      ${value ? `<p style="font-size: 20px; font-weight: 600; color: #166534;">${value}</p>` : ""}
      <p>
        <a href="${publicUrl}" style="display:inline-block; padding: 10px 20px; background:#FF2B00; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">
          Ver proposta
        </a>
      </p>
      <p style="color:#667085; font-size: 13px;">Se o botão não funcionar, copie e cole este link: ${publicUrl}</p>
    </div>
  `;
}

interface SendProposalEmailArgs {
  to: string;
  cc?: string[];
  bcc?: string[];
  proposal: Proposal;
  publicUrl: string;
  agencyName: string;
}

export async function sendProposalEmail({ to, cc, bcc, proposal, publicUrl, agencyName }: SendProposalEmailArgs): Promise<void> {
  if (!isEmailConfigured()) {
    throw new EmailNotConfiguredError();
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    cc: cc && cc.length > 0 ? cc : undefined,
    bcc: bcc && bcc.length > 0 ? bcc : undefined,
    subject: `Proposta comercial — ${proposal.name}`,
    html: proposalEmailHtml(proposal, publicUrl, agencyName),
  });

  if (error) {
    throw new Error(error.message ?? "Não foi possível enviar o e-mail.");
  }
}
