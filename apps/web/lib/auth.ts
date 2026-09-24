import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@zenite-mkt/db";
import { sendPasswordResetEmail, isEmailConfigured } from "./email";

const PORTAL_HOST = process.env.PORTAL_HOST ?? "portal.hubzenite.com.br";
const MAIN_APP_URL = process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://zenith-flow-one.vercel.app";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // Sem isso, o Better Auth só confia na origem derivada de `baseURL` (um
  // único host) — qualquer pedido de login vindo de outro host, como
  // portal.hubzenite.com.br, era rejeitado por checagem de origem (CSRF)
  // antes mesmo de chegar na comparação de senha, e aparecia pro usuário
  // como "e-mail ou senha inválidos" (bug encontrado em 2026-09-24).
  trustedOrigins: [MAIN_APP_URL, `https://${PORTAL_HOST}`],
  emailAndPassword: {
    enabled: true,
    // Envio real de e-mail (verificação) fica para a Fase 2 (seção 41.1 do
    // manual). Por ora, contas nascem com emailVerified=false mas já
    // utilizáveis, documentado em docs/STATUS.md.
    requireEmailVerification: false,
    // "Esqueci minha senha" (pedido do Kevin, 2026-09-23) — vale pra equipe
    // interna e Portal do Cliente, mesmo login único (seção 18 do manual).
    // Sem Resend configurado, lança erro explícito em vez de fingir sucesso.
    sendResetPassword: async ({ user, url }) => {
      if (!isEmailConfigured()) {
        throw new Error("Resend não configurado — defina RESEND_API_KEY e RESEND_FROM_EMAIL.");
      }
      await sendPasswordResetEmail({ to: user.email, url, userName: user.name });
    },
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova o cookie 1x por dia de uso
  },
});

export type Session = typeof auth.$Infer.Session;
