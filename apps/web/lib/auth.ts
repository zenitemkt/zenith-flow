import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@zenite-mkt/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Envio real de e-mail (verificação, reset de senha) fica para a Fase 2
    // (seção 41.1 do manual, adapters Resend/Brevo). Por ora, contas nascem
    // com emailVerified=false mas já utilizáveis, documentado em docs/STATUS.md.
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova o cookie 1x por dia de uso
  },
});

export type Session = typeof auth.$Infer.Session;
