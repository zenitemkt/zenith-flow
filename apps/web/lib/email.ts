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

function emailShell(bodyHtml: string): string {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #101828;">${bodyHtml}</div>`;
}

function ctaButton(url: string, label: string): string {
  return `
    <p>
      <a href="${url}" style="display:inline-block; padding: 10px 20px; background:#FF2B00; color:#fff; text-decoration:none; border-radius:8px; font-weight:600;">
        ${label}
      </a>
    </p>
    <p style="color:#667085; font-size: 13px;">Se o botão não funcionar, copie e cole este link: ${url}</p>
  `;
}

interface SendEmailArgs {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
}

/** Núcleo genérico — todo template específico do produto chama esta função. */
export async function sendEmail({ to, cc, bcc, subject, html }: SendEmailArgs): Promise<void> {
  if (!isEmailConfigured()) {
    throw new EmailNotConfiguredError();
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    cc: cc && cc.length > 0 ? cc : undefined,
    bcc: bcc && bcc.length > 0 ? bcc : undefined,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message ?? "Não foi possível enviar o e-mail.");
  }
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
  const value = proposal.valueCents !== null ? formatProposalValue(proposal.valueCents) : null;
  const html = emailShell(`
    <p>Olá!</p>
    <p>${agencyName} enviou uma proposta comercial pra você: <strong>${proposal.name}</strong>.</p>
    ${value ? `<p style="font-size: 20px; font-weight: 600; color: #166534;">${value}</p>` : ""}
    ${ctaButton(publicUrl, "Ver proposta")}
  `);
  await sendEmail({ to, cc, bcc, subject: `Proposta comercial — ${proposal.name}`, html });
}

interface SendNpsInviteEmailArgs {
  to: string;
  contactName: string;
  campaignName: string;
  question: string;
  publicUrl: string;
  agencyName: string;
}

export async function sendNpsInviteEmail({ to, contactName, campaignName, question, publicUrl, agencyName }: SendNpsInviteEmailArgs): Promise<void> {
  const html = emailShell(`
    <p>Olá, ${contactName}!</p>
    <p>${agencyName} gostaria de saber sua opinião: <strong>${question}</strong></p>
    ${ctaButton(publicUrl, "Responder pesquisa")}
  `);
  await sendEmail({ to, subject: `Pesquisa rápida — ${campaignName}`, html });
}

interface SendEnpsInviteEmailArgs {
  to: string;
  employeeName: string;
  campaignName: string;
  question: string;
  publicUrl: string;
  agencyName: string;
}

export async function sendEnpsInviteEmail({ to, employeeName, campaignName, question, publicUrl, agencyName }: SendEnpsInviteEmailArgs): Promise<void> {
  const html = emailShell(`
    <p>Olá, ${employeeName}!</p>
    <p>${agencyName} quer saber sua opinião, de forma anônima: <strong>${question}</strong></p>
    <p style="color:#667085; font-size: 13px;">Sua resposta nunca é associada ao seu nome — nem para quem administra a pesquisa.</p>
    ${ctaButton(publicUrl, "Responder pesquisa")}
  `);
  await sendEmail({ to, subject: `Pesquisa interna anônima — ${campaignName}`, html });
}

interface SendTeamInviteEmailArgs {
  to: string;
  inviteUrl: string;
  agencyName: string;
  roleLabel: string;
}

export async function sendTeamInviteEmail({ to, inviteUrl, agencyName, roleLabel }: SendTeamInviteEmailArgs): Promise<void> {
  const html = emailShell(`
    <p>Olá!</p>
    <p>Você foi convidado(a) pra entrar no time de <strong>${agencyName}</strong> como <strong>${roleLabel}</strong>.</p>
    ${ctaButton(inviteUrl, "Aceitar convite")}
  `);
  await sendEmail({ to, subject: `Convite para ${agencyName}`, html });
}

interface SendContentApprovalEmailArgs {
  to: string;
  cc?: string[];
  bcc?: string[];
  contentTitle: string;
  publicUrl: string;
  agencyName: string;
}

export async function sendContentApprovalEmail({ to, cc, bcc, contentTitle, publicUrl, agencyName }: SendContentApprovalEmailArgs): Promise<void> {
  const html = emailShell(`
    <p>Olá!</p>
    <p>${agencyName} enviou uma peça pra sua aprovação: <strong>${contentTitle}</strong>.</p>
    ${ctaButton(publicUrl, "Ver e aprovar")}
  `);
  await sendEmail({ to, cc, bcc, subject: `Aprovação pendente — ${contentTitle}`, html });
}

interface SendPasswordResetEmailArgs {
  to: string;
  url: string;
  userName: string;
}

/** Chamada por `emailAndPassword.sendResetPassword` (apps/web/lib/auth.ts) — vale tanto pra equipe interna quanto pro Portal do Cliente, mesmo login único. */
export async function sendPasswordResetEmail({ to, url, userName }: SendPasswordResetEmailArgs): Promise<void> {
  const html = emailShell(`
    <p>Olá, ${userName}!</p>
    <p>Recebemos um pedido pra redefinir sua senha. Se não foi você, pode ignorar este e-mail — sua senha continua a mesma.</p>
    ${ctaButton(url, "Redefinir senha")}
    <p style="color:#667085; font-size: 13px;">Este link expira em 1 hora.</p>
  `);
  await sendEmail({ to, subject: "Redefinir sua senha", html });
}
