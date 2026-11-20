import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/presets/",
  "/signup",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/aprovar",
  "/pesquisa",
  "/pesquisa-interna",
  "/proposta",
  // Política de privacidade: URL cadastrada no app da Meta, precisa abrir sem login.
  "/privacidade",
  "/api/auth",
  "/api/approvals",
  "/api/public/survey",
  "/api/public/enps",
  "/api/public/proposals",
  "/api/collect",
  "/api/v1/integrations/site-leads",
  "/api/public/blog-views",
  // "Sair da lista" dos e-mails de prospecção: quem recebe não tem login.
  "/api/public/prospect-optout",
  // Respostas aos e-mails de prospecção (webhook do Resend, protegido pela assinatura Svix na rota).
  "/api/public/prospect-inbound",
  // Rotina diária da prospecção: chamada pelo Vercel Cron, protegida por CRON_SECRET na própria rota.
  "/api/cron/prospeccao",
  // Agendador de redes: chamado pelo cron externo, protegido por CRON_SECRET na própria rota.
  "/api/cron/social-publish",
  "/api/cron/site-monitor",
  "/api/cron/meta-sync",
  "/api/cron/competitors-sync",
  // Mini-chat de Instagram: chamado pela Meta (webhook) e por quem clica no botão da DM, nunca com cookie de
  // sessão. Webhook protegido por assinatura (x-hub-signature-256) + verify token no handshake, não por login.
  "/api/instagram/webhook",
  "/api/assistant/webhook",
  "/api/meta/leads/webhook",
  "/api/assistant/process",
  "/api/instagram/click",
  // Autenticação própria por chave (x-draft-agent-key, timingSafeEqual) pra
  // além do cookie de sessão — o agente externo (rotina agendada) não tem
  // cookie, então precisa passar pelo middleware antes de chegar na checagem
  // dupla da própria rota. Ver lib/content-automation-auth.ts.
  "/api/admin/agent-rules",
  "/api/admin/blog-drafts",
  "/api/admin/search-console/queries",
];

function isPublicPath(pathname: string): boolean {
  // A extensão não tem cookie de sessão; esta rota usa bearer token próprio da agência.
  if (/^\/api\/competitors\/[^/]+\/ads$/.test(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * portal.hubzenite.com.br serve o mesmo deploy que o domínio principal, sem
 * restrição de rota por host (pedido do Kevin, 2026-09-24 — reverte a
 * restrição anterior, que forçava equipe interna a sair pro domínio
 * principal e logar de novo lá). Quem entra por qualquer um dos dois
 * domínios cai no mesmo roteamento por papel que já existe em
 * `(app)/layout.tsx` (cliente → /portal) e `/portal/layout.tsx` (equipe →
 * /) — nenhuma lógica nova precisou entrar aqui, só parou de restringir o
 * host. Ver docs/DECISIONS.md.
 *
 * Checagem leve de cookie (sem hit no banco) — a validação completa da sessão
 * acontece nas páginas/route handlers via auth.api.getSession (seção 7.2 do
 * manual: o backend nunca confia apenas no que o cliente afirma).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPublicPath(pathname)) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo-z.svg).*)"],
};
