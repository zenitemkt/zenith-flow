import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/aprovar",
  "/pesquisa",
  "/pesquisa-interna",
  "/proposta",
  "/api/auth",
  "/api/approvals",
  "/api/public/survey",
  "/api/public/enps",
  "/api/public/proposals",
  "/api/collect",
  "/api/v1/integrations/site-leads",
];

function isPublicPath(pathname: string): boolean {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
